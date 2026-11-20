{{/*
=====================================================================
 Shared template helpers
 - "taskflow.labels"  : common labels stamped on every object
 - "taskflow.image"   : builds  <registry>/<repository>:<tag>
=====================================================================
*/}}

{{- define "taskflow.labels" -}}
app.kubernetes.io/part-of: taskflow
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}

{{/*
Usage: include "taskflow.image" (dict "root" $ "svc" $svc)
A per-service image.tag overrides the global image.tag.
An empty image.registry means "use the bare local image name" (k3d / kind / minikube).
*/}}
{{- define "taskflow.image" -}}
{{- $reg := .root.Values.image.registry -}}
{{- $tag := .svc.image.tag | default .root.Values.image.tag -}}
{{- if $reg }}{{ $reg }}/{{ end }}{{ .svc.image.repository }}:{{ $tag }}
{{- end }}
