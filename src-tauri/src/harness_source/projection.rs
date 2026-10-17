//! Env values, headers and permission rules never leave the disk; unparsable text projects to "".

use super::scope::ReadClass;
use serde_json::{json, Map, Value};

pub(super) fn project(class: ReadClass, text: &str) -> String {
    match class {
        ReadClass::Text => text.to_string(),
        ReadClass::TomlMcpHeaders => toml_mcp_headers(text),
        ReadClass::McpServers
        | ReadClass::ClaudeSettings
        | ReadClass::CodexHooks
        | ReadClass::PackageScripts => match serde_json::from_str::<Value>(text) {
            Ok(Value::Object(object)) => Value::Object(json_projection(class, &object)).to_string(),
            Ok(_) => "{}".to_string(),
            Err(_) => String::new(),
        },
        ReadClass::NotAllowed | ReadClass::Denied | ReadClass::Invalid => String::new(),
    }
}

fn json_projection(class: ReadClass, object: &Map<String, Value>) -> Map<String, Value> {
    let mut out = Map::new();
    match class {
        ReadClass::McpServers => {
            if let Some(Value::Object(servers)) = object.get("mcpServers") {
                let names: Map<String, Value> = servers
                    .keys()
                    .map(|name| (name.clone(), json!({})))
                    .collect();
                out.insert("mcpServers".into(), Value::Object(names));
            }
        }
        ReadClass::ClaudeSettings => {
            if let Some(hooks) = object.get("hooks") {
                out.insert("hooks".into(), hooks.clone());
            }
            if let Some(Value::Object(permissions)) = object.get("permissions") {
                let mut counted = Map::new();
                for key in ["allow", "deny", "ask"] {
                    if let Some(Value::Array(rules)) = permissions.get(key) {
                        counted.insert(key.into(), Value::Array(vec![json!(""); rules.len()]));
                    }
                }
                out.insert("permissions".into(), Value::Object(counted));
            }
        }
        ReadClass::CodexHooks => {
            if let Some(hooks) = object.get("hooks") {
                out.insert("hooks".into(), hooks.clone());
            }
        }
        ReadClass::PackageScripts => {
            if let Some(scripts) = object.get("scripts") {
                out.insert("scripts".into(), scripts.clone());
            }
        }
        _ => {}
    }
    out
}

fn mcp_header(line: &str) -> Option<&str> {
    let trimmed = line.trim();
    let after = trimmed.strip_prefix('[')?;
    let table_array = after.starts_with('[');
    let rest = after.strip_prefix('[').unwrap_or(after).trim_start();
    let named = ["mcp_servers", "\"mcp_servers\"", "'mcp_servers'"]
        .iter()
        .find_map(|name| rest.strip_prefix(name))?;
    if !matches!(named.trim_start().chars().next(), Some('.' | ']')) {
        return None;
    }
    let mut quote: Option<char> = None;
    for (index, ch) in trimmed.char_indices() {
        match (quote, ch) {
            (Some(open), c) if c == open => quote = None,
            (None, '"' | '\'') => quote = Some(ch),
            (None, ']') => {
                let end = index + 1;
                let closes_array = table_array && trimmed[end..].starts_with(']');
                return Some(&trimmed[..end + usize::from(closes_array)]);
            }
            _ => {}
        }
    }
    None
}

fn toml_mcp_headers(text: &str) -> String {
    text.lines()
        .filter_map(mcp_header)
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "sk-test-SECRET";

    #[test]
    fn mcp_projection_keeps_server_names_and_drops_env_and_headers() {
        let text = format!(
            r#"{{"mcpServers":{{"zeta":{{"command":"x","env":{{"TOKEN":"{SECRET}"}}}},"alpha":{{"url":"u","headers":{{"Authorization":"Bearer {SECRET}"}}}}}},"other":"{SECRET}"}}"#
        );
        let out = project(ReadClass::McpServers, &text);
        assert_eq!(out, r#"{"mcpServers":{"alpha":{},"zeta":{}}}"#);
        assert!(!out.contains(SECRET));
    }

    #[test]
    fn claude_settings_projection_keeps_hooks_and_permission_counts_only() {
        let text = format!(
            r#"{{"env":{{"K":"{SECRET}"}},"apiKeyHelper":"{SECRET}","hooks":{{"PreToolUse":[{{"matcher":"Bash","hooks":[{{"type":"command","command":"a.sh"}}]}}]}},"permissions":{{"allow":["Bash({SECRET})","Read"],"deny":["Read(.env)"],"defaultMode":"{SECRET}"}}}}"#
        );
        let out = project(ReadClass::ClaudeSettings, &text);
        let value: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(value["permissions"]["allow"], json!(["", ""]));
        assert_eq!(value["permissions"]["deny"], json!([""]));
        assert!(value["permissions"].get("ask").is_none());
        assert!(value["permissions"].get("defaultMode").is_none());
        assert_eq!(
            value["hooks"]["PreToolUse"][0]["hooks"][0]["command"],
            "a.sh"
        );
        assert!(value.get("env").is_none() && value.get("apiKeyHelper").is_none());
        assert!(!out.contains(SECRET));
    }

    #[test]
    fn codex_hooks_projection_keeps_hooks_only() {
        let text = format!(r#"{{"token":"{SECRET}","hooks":{{"Stop":[]}}}}"#);
        let out = project(ReadClass::CodexHooks, &text);
        assert_eq!(out, r#"{"hooks":{"Stop":[]}}"#);
        assert!(!out.contains(SECRET));
    }

    #[test]
    fn toml_projection_keeps_mcp_headers_and_drops_every_value_line() {
        let text = format!(
            "model = \"{SECRET}\"\n[mcp_servers.git]\ncommand = \"{SECRET}\"\n  [ mcp_servers . \"two]\" ] # {SECRET} ]\n[[mcp_servers.arr]] # {SECRET}\n['mcp_servers'.q.env]\nTOKEN = \"{SECRET}\"\n[mcp_serversX]\n[other]\nkey = \"{SECRET}\"\n[mcp_servers.open # {SECRET}\n"
        );
        let out = project(ReadClass::TomlMcpHeaders, &text);
        assert_eq!(
            out,
            "[mcp_servers.git]\n[ mcp_servers . \"two]\" ]\n[[mcp_servers.arr]]\n['mcp_servers'.q.env]"
        );
        assert!(!out.contains(SECRET));
    }

    #[test]
    fn package_projection_keeps_scripts_only() {
        let text = format!(
            r#"{{"name":"{SECRET}","dependencies":{{"x":"{SECRET}"}},"scripts":{{"test":"vitest","build":"next build"}}}}"#
        );
        let out = project(ReadClass::PackageScripts, &text);
        assert_eq!(out, r#"{"scripts":{"build":"next build","test":"vitest"}}"#);
        assert!(!out.contains(SECRET));
    }

    #[test]
    fn unparsable_config_projects_to_empty_text() {
        for class in [
            ReadClass::McpServers,
            ReadClass::ClaudeSettings,
            ReadClass::CodexHooks,
            ReadClass::PackageScripts,
        ] {
            let broken = format!("{{\"token\": \"{SECRET}\"");
            assert_eq!(project(class, &broken), "", "{class:?}");
            assert_eq!(
                project(class, &format!("[\"{SECRET}\"]")),
                "{}",
                "{class:?}"
            );
        }
        assert_eq!(project(ReadClass::Text, "x"), "x");
        assert_eq!(project(ReadClass::Denied, SECRET), "");
    }
}
