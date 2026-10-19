#!/usr/bin/env bash
# Shared .env loading for PostgreSQL backup/restore scripts.
# Existing process variables win; missing values are loaded from project files.
load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      if [[ -n "$line" && ! "$line" =~ ^# && "$line" =~ = ]]; then
        local key="${line%%=*}"
        local val="${line#*=}"
        if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
          continue
        fi
        val="${val%\"}"; val="${val#\"}"
        val="${val%\'}"; val="${val#\'}"
        if [[ -z "${!key:-}" ]]; then
          export "${key}=${val}"
        fi
      fi
    done < "$env_file"
  fi
}

load_project_env() {
  local project_root="$1"
  load_env_file "$project_root/.env"
  load_env_file "$project_root/backend/.env"
}
