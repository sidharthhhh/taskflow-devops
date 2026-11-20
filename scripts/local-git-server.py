#!/usr/bin/env python3
"""
Local Git server for ArgoCD (no GitHub push required)
=====================================================

ArgoCD is a *pull*-based GitOps tool: it clones a Git repository and syncs the
cluster to whatever is committed there. Normally that repo is GitHub. To run the
full GitOps loop locally WITHOUT pushing to GitHub, this tiny server exposes a
bare repository over Git's "smart HTTP" protocol by wrapping the `git http-backend`
CGI program that ships with Git.

It runs INSIDE the k3d cluster (argocd/local-git-server/git-server.yaml), so it is
only reachable from the cluster - never from your LAN:

    ArgoCD reads from:  http://git-server.gitops.svc.cluster.local:8765/taskflow-devops.git
    You push via:       kubectl -n gitops port-forward svc/git-server 8765:8765
                        git push local-gitops microservice

Usage:  python local-git-server.py --repo /srv/git/taskflow-devops.git [--allow-push]
"""
import argparse
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

URL_NAME = "/taskflow-devops.git"   # path clients use in the URL
REPO = Path(".")                    # set from --repo
ALLOW_PUSH = False


class GitHandler(BaseHTTPRequestHandler):
    def _run_backend(self):
        url = urlsplit(self.path)
        if not url.path.startswith(URL_NAME):
            self.send_error(404, "unknown repository")
            return
        if not ALLOW_PUSH and ("git-receive-pack" in url.path
                               or "service=git-receive-pack" in url.query):
            self.send_error(403, "read-only server")
            return

        body = b""
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            body = self.rfile.read(length)

        env = dict(os.environ)
        env.update({
            "GIT_PROJECT_ROOT": str(REPO.parent),
            "PATH_INFO": url.path.replace(URL_NAME, "/" + REPO.name, 1),
            "GIT_HTTP_EXPORT_ALL": "1",
            "REQUEST_METHOD": self.command,
            "QUERY_STRING": url.query,
            "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            "CONTENT_LENGTH": str(len(body)),
            "REMOTE_ADDR": self.client_address[0],
            "REMOTE_USER": "local",          # lets http-backend accept pushes
            "GIT_PROTOCOL": self.headers.get("Git-Protocol", ""),
            "HTTP_CONTENT_ENCODING": self.headers.get("Content-Encoding", ""),
        })
        proc = subprocess.run(["git", "http-backend"], input=body, env=env,
                              capture_output=True)
        if proc.returncode != 0 and not proc.stdout:
            self.send_error(500, proc.stderr.decode(errors="replace")[:200])
            return

        # CGI output = headers, blank line, body
        raw = proc.stdout
        sep, sep_len = raw.find(b"\r\n\r\n"), 4
        if sep == -1:
            sep, sep_len = raw.find(b"\n\n"), 2
        head, payload = raw[:sep].decode(errors="replace"), raw[sep + sep_len:]

        status, headers = 200, []
        for line in head.splitlines():
            if not line.strip():
                continue
            key, _, value = line.partition(":")
            if key.lower() == "status":
                status = int(value.strip().split()[0])
            else:
                headers.append((key.strip(), value.strip()))
        self.send_response(status)
        for key, value in headers:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = _run_backend
    do_POST = _run_backend

    def log_message(self, fmt, *args):
        sys.stderr.write("[git-server] " + (fmt % args) + "\n")


def main():
    global REPO, ALLOW_PUSH
    parser = argparse.ArgumentParser(description="Smart-HTTP git server for ArgoCD")
    parser.add_argument("--repo", required=True, help="path to a bare git repository")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--allow-push", action="store_true")
    args = parser.parse_args()
    REPO, ALLOW_PUSH = Path(args.repo).resolve(), args.allow_push
    print(f"Serving {REPO} at http://{args.bind}:{args.port}{URL_NAME} "
          f"(push {'enabled' if ALLOW_PUSH else 'disabled'})", flush=True)
    ThreadingHTTPServer((args.bind, args.port), GitHandler).serve_forever()


if __name__ == "__main__":
    main()
