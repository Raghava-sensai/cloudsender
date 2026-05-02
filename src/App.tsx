import { useEffect, useMemo, useState } from "react";
import {
  clearAuthToken,
  createTrigger,
  deleteTrigger,
  getAuthToken,
  getCurrentUser,
  listLogs,
  listTemplates,
  listTriggers,
  login,
  previewTestEvent,
  sendTestEvent,
  updateTemplate,
  updateTrigger,
} from "./api";
import type { DashboardUser, EmailLog, EmailPreview, EmailTemplate, TestEventPayload, Trigger } from "./types";
import { EVENT_TYPES } from "./types";

type View = "triggers" | "templates" | "logs" | "test";
type EventType = (typeof EVENT_TYPES)[number];
interface TriggerDraft {
  workspaceId: string;
  name: string;
  eventType: EventType;
  enabled: boolean;
  templateId: string;
  cooldownSeconds: number;
}

export function App() {
  const [view, setView] = useState<View>("triggers");
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [status, setStatus] = useState<string>("Loading workspace data...");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  async function refresh() {
    if (!user) {
      return;
    }

    try {
      setError(null);
      const [nextTriggers, nextTemplates, nextLogs] = await Promise.all([
        listTriggers(),
        listTemplates(),
        listLogs(),
      ]);
      setTriggers(nextTriggers);
      setTemplates(nextTemplates);
      setLogs(nextLogs);
      setStatus("Workspace data loaded.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setStatus("Unable to load workspace data.");
    }
  }

  useEffect(() => {
    if (!getAuthToken()) {
      setAuthReady(true);
      return;
    }

    void getCurrentUser()
      .then((nextUser) => setUser(nextUser))
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (user) {
      void refresh();
    }
  }, [user?.id]);

  const activeView = useMemo(() => {
    if (view === "triggers") {
      return (
        <TriggerManagement
          templates={templates}
          triggers={triggers}
          onCreate={async (input) => {
            const created = await createTrigger(input);
            setTriggers((current) => [created, ...current]);
          }}
          onUpdate={async (input) => {
            const updated = await updateTrigger(input);
            setTriggers((current) =>
              current.map((trigger) => (trigger.id === updated.id ? updated : trigger)),
            );
          }}
          onDelete={async (id) => {
            await deleteTrigger(id);
            setTriggers((current) => current.filter((trigger) => trigger.id !== id));
          }}
        />
      );
    }

    if (view === "templates") {
      return (
        <TemplateEditor
          templates={templates}
          onSave={async (input) => {
            const updated = await updateTemplate(input);
            setTemplates((current) =>
              current.map((template) => (template.id === updated.id ? updated : template)),
            );
          }}
        />
      );
    }

    if (view === "logs") {
      return <DeliveryLogs logs={logs} onRefresh={refresh} />;
    }

    return (
      <TestEventSender
        onSend={async (payload) => {
          await sendTestEvent(payload);
          await refresh();
        }}
        onPreview={previewTestEvent}
      />
    );
  }, [logs, templates, triggers, user, view]);

  if (!authReady) {
    return <main className="authShell"><div className="panel">Checking session...</div></main>;
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={async (email, password) => {
          const result = await login(email, password);
          setUser(result.user);
        }}
      />
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Cloudflare MVP</p>
          <h1>Email Automation</h1>
        </div>
        <nav className="nav" aria-label="Dashboard views">
          <button className={view === "triggers" ? "active" : ""} onClick={() => setView("triggers")}>
            Triggers
          </button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}>
            Templates
          </button>
          <button className={view === "logs" ? "active" : ""} onClick={() => setView("logs")}>
            Logs
          </button>
          <button className={view === "test" ? "active" : ""} onClick={() => setView("test")}>
            Test Event
          </button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Default workspace</p>
            <h2>{titleForView(view)}</h2>
          </div>
          <div className="topbarActions">
            <span>{user.email}</span>
            <button className="secondary" onClick={() => void refresh()}>
              Refresh
            </button>
            <button
              className="secondary"
              onClick={() => {
                clearAuthToken();
                setUser(null);
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : <div className="status">{status}</div>}
        {activeView}
      </section>
    </main>
  );
}

function LoginPage({ onLogin }: { onLogin(email: string, password: string): Promise<void> }) {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Sign in to manage automations.");

  return (
    <main className="authShell">
      <form
        className="panel authPanel"
        onSubmit={(event) => {
          event.preventDefault();
          setStatus("Signing in...");
          void onLogin(email, password).catch((error: unknown) =>
            setStatus(error instanceof Error ? error.message : String(error)),
          );
        }}
      >
        <div>
          <p className="eyebrow">Protected Dashboard</p>
          <h1>Email Automation</h1>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit">Sign in</button>
        <div className="status compact">{status}</div>
      </form>
    </main>
  );
}

function TriggerManagement({
  templates,
  triggers,
  onCreate,
  onUpdate,
  onDelete,
}: {
  templates: EmailTemplate[];
  triggers: Trigger[];
  onCreate(input: Partial<Trigger>): Promise<void>;
  onUpdate(input: Partial<Trigger> & { id: string }): Promise<void>;
  onDelete(id: string): Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string>("new");
  const [draft, setDraft] = useState(() => emptyTriggerDraft(templates));
  const [conditionsText, setConditionsText] = useState("{}");
  const [formStatus, setFormStatus] = useState("Create a new rule or select an existing one.");

  const selectedTrigger = triggers.find((trigger) => trigger.id === selectedId);

  useEffect(() => {
    if (!selectedTrigger) {
      return;
    }

    setDraft({
      workspaceId: selectedTrigger.workspaceId,
      name: selectedTrigger.name,
      eventType: selectedTrigger.eventType as EventType,
      enabled: selectedTrigger.enabled,
      templateId: selectedTrigger.templateId ?? "",
      cooldownSeconds: selectedTrigger.cooldownSeconds,
    });
    setConditionsText(JSON.stringify(selectedTrigger.conditions, null, 2));
    setFormStatus("Editing selected automation rule.");
  }, [selectedTrigger?.id]);

  useEffect(() => {
    if (selectedId === "new") {
      setDraft((current) => ({
        ...current,
        templateId:
          templates.find((template) => template.eventType === current.eventType)?.id ??
          templates[0]?.id ??
          "",
      }));
    }
  }, [selectedId, templates]);

  return (
    <div className="grid two">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseConditions(conditionsText);
          if (!parsed.ok) {
            setFormStatus(parsed.error);
            return;
          }

          const payload = {
            workspaceId: draft.workspaceId,
            name: draft.name,
            eventType: draft.eventType,
            cooldownSeconds: draft.cooldownSeconds,
            enabled: draft.enabled,
            conditions: parsed.value,
            templateId: draft.templateId || null,
          };

          const action =
            selectedId === "new"
              ? onCreate(payload)
              : onUpdate({
                  id: selectedId,
                  ...payload,
                });

          void action
            .then(() => {
              setFormStatus(selectedId === "new" ? "Rule created and saved to D1." : "Rule updated in D1.");
              if (selectedId === "new") {
                setDraft(emptyTriggerDraft(templates));
                setConditionsText("{}");
              }
            })
            .catch((error: unknown) =>
              setFormStatus(error instanceof Error ? error.message : String(error)),
            );
        }}
      >
        <div className="panelHeader">
          <h3>{selectedId === "new" ? "Create Automation Rule" : "Edit Automation Rule"}</h3>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSelectedId("new");
              setDraft(emptyTriggerDraft(templates));
              setConditionsText("{}");
              setFormStatus("Creating a new automation rule.");
            }}
          >
            New
          </button>
        </div>
        <label>
          Name
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          Event type
          <select
            value={draft.eventType}
            onChange={(event) => {
              const eventType = event.target.value as EventType;
              setDraft({
                ...draft,
                eventType,
                templateId:
                  templates.find((template) => template.eventType === eventType)?.id ??
                  draft.templateId,
              });
            }}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Template
          <select
            value={draft.templateId}
            onChange={(event) => setDraft({ ...draft, templateId: event.target.value })}
          >
            <option value="">Use event default</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.eventType})
              </option>
            ))}
          </select>
        </label>
        <label>
          Cooldown seconds
          <input
            type="number"
            min={0}
            value={draft.cooldownSeconds}
            onChange={(event) =>
              setDraft({ ...draft, cooldownSeconds: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Conditions JSON
          <textarea
            value={conditionsText}
            onChange={(event) => setConditionsText(event.target.value)}
          />
        </label>
        <label className="checkboxLabel">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          />
          Enabled
        </label>
        <div className="actions">
          <button type="submit">{selectedId === "new" ? "Create rule" : "Save rule"}</button>
          {selectedId !== "new" ? (
            <button
              className="danger"
              type="button"
              onClick={() => {
                if (!window.confirm("Delete this automation rule?")) {
                  return;
                }

                void onDelete(selectedId)
                  .then(() => {
                    setSelectedId("new");
                    setDraft(emptyTriggerDraft(templates));
                    setConditionsText("{}");
                    setFormStatus("Rule deleted from D1.");
                  })
                  .catch((error: unknown) =>
                    setFormStatus(error instanceof Error ? error.message : String(error)),
                  );
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
        <div className="status compact">{formStatus}</div>
      </form>

      <div className="panel list">
        <h3>Automation Rules</h3>
        {triggers.length === 0 ? <div className="status compact">No rules yet.</div> : null}
        {triggers.map((trigger) => (
          <article className={`row selectable ${selectedId === trigger.id ? "selected" : ""}`} key={trigger.id}>
            <div>
              <strong>{trigger.name}</strong>
              <span>
                {trigger.eventType} · {trigger.enabled ? "enabled" : "disabled"} · {trigger.cooldownSeconds}s cooldown
              </span>
            </div>
            <div className="rowActions">
              <button className="secondary" onClick={() => setSelectedId(trigger.id)}>
                Edit
              </button>
              <button
                className={trigger.enabled ? "secondary" : ""}
                onClick={() => void onUpdate({ id: trigger.id, enabled: !trigger.enabled })}
              >
                {trigger.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  templates,
  onSave,
}: {
  templates: EmailTemplate[];
  onSave(input: Partial<EmailTemplate> & { id: string }): Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const [draft, setDraft] = useState<EmailTemplate | null>(selected ?? null);
  const [saveStatus, setSaveStatus] = useState("Templates are loaded from D1.");

  useEffect(() => {
    setSelectedId((current) => current || templates[0]?.id || "");
  }, [templates]);

  useEffect(() => {
    setDraft(selected ?? null);
    setSaveStatus("Template loaded from D1.");
  }, [selected?.id]);

  if (!draft) {
    return <div className="panel">No templates found. Run the D1 migration seed.</div>;
  }

  return (
    <div className="grid two">
      <div className="panel">
        <h3>Templates</h3>
        <div className="status compact">Select a template to load its current D1 version.</div>
        <select value={draft.id} onChange={(event) => setSelectedId(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.eventType}
            </option>
          ))}
        </select>
      </div>

      <form
        className="panel editor"
        onSubmit={(event) => {
          event.preventDefault();
          setSaveStatus("Saving template...");
          void onSave(draft)
            .then(() => setSaveStatus("Template saved to D1."))
            .catch((error: unknown) =>
              setSaveStatus(error instanceof Error ? error.message : String(error)),
            );
        }}
      >
        <div className="panelHeader">
          <h3>Edit Template</h3>
          <span className="badge neutral">{draft.eventType}</span>
        </div>
        <label>
          Name
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          Subject
          <input
            value={draft.subject}
            onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
          />
        </label>
        <label>
          Text body
          <textarea
            value={draft.textBody}
            onChange={(event) => setDraft({ ...draft, textBody: event.target.value })}
          />
        </label>
        <label>
          HTML body
          <textarea
            value={draft.htmlBody}
            onChange={(event) => setDraft({ ...draft, htmlBody: event.target.value })}
          />
        </label>
        <button type="submit">Save template</button>
        <div className="status compact">{saveStatus}</div>
      </form>
    </div>
  );
}

function emptyTriggerDraft(templates: EmailTemplate[]): TriggerDraft {
  return {
    workspaceId: "default",
    name: "New automation rule",
    eventType: EVENT_TYPES[0],
    enabled: true,
    templateId: templates.find((template) => template.eventType === EVENT_TYPES[0])?.id ?? "",
    cooldownSeconds: 300,
  };
}

function parseConditions(
  value: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Conditions must be a JSON object." };
    }

    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Conditions JSON is invalid." };
  }
}

function DeliveryLogs({ logs, onRefresh }: { logs: EmailLog[]; onRefresh(): Promise<void> }) {
  return (
    <div className="panel">
      <div className="panelHeader">
        <h3>Delivery Logs</h3>
        <button className="secondary" onClick={() => void onRefresh()}>
          Refresh logs
        </button>
      </div>
      <div className="table">
        <div className="tableHead">
          <span>Status</span>
          <span>Recipient</span>
          <span>Event</span>
          <span>Attempts</span>
          <span>Created</span>
        </div>
        {logs.map((log) => (
          <div className="tableRow" key={log.id}>
            <span className={`badge ${log.status}`}>{log.status}</span>
            <span>{log.recipientEmail ?? "Unknown"}</span>
            <span>{log.eventType}</span>
            <span>{log.attempts}</span>
            <span>{new Date(log.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestEventSender({
  onSend,
  onPreview,
}: {
  onSend(payload: TestEventPayload): Promise<void>;
  onPreview(payload: TestEventPayload): Promise<EmailPreview>;
}) {
  const [payload, setPayload] = useState<TestEventPayload>({
    userId: "user_123",
    eventType: "user.signup",
    metadata: {
      email: "person@example.com",
      workspaceId: "default",
    },
    timestamp: new Date().toISOString(),
  });
  const [result, setResult] = useState(
    "Ready. Gmail mode sends a real email when Gmail OAuth2 secrets and EMAIL_FROM_ADDRESS are configured.",
  );
  const [preview, setPreview] = useState<EmailPreview | null>(null);

  function buildPayload(): TestEventPayload {
    return {
      ...payload,
      timestamp: new Date().toISOString(),
      metadata: {
        ...payload.metadata,
        eventId: crypto.randomUUID(),
      },
    };
  }

  return (
    <div className="grid two">
      <form
        className="panel editor"
        onSubmit={(event) => {
          event.preventDefault();
          setResult("Sending...");
          const nextPayload = buildPayload();
          setPayload(nextPayload);
          void onSend(nextPayload)
            .then(() =>
              setResult(
                "Event accepted and queued. Check Delivery Logs, Worker output, and your recipient inbox.",
              ),
            )
            .catch((error: unknown) => setResult(error instanceof Error ? error.message : String(error)));
        }}
      >
        <h3>Manual Test Event</h3>
        <div className="status compact">
          Preview renders the D1 template without sending. Send queues the event for Gmail delivery.
        </div>
        <label>
          User ID
          <input value={payload.userId} onChange={(event) => setPayload({ ...payload, userId: event.target.value })} />
        </label>
        <label>
          Event type
          <select value={payload.eventType} onChange={(event) => setPayload({ ...payload, eventType: event.target.value })}>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recipient email
          <input
            value={payload.metadata.email}
            onChange={(event) =>
              setPayload({ ...payload, metadata: { ...payload.metadata, email: event.target.value } })
            }
          />
        </label>
        <div className="actions">
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setResult("Rendering preview...");
              const nextPayload = buildPayload();
              setPayload(nextPayload);
              void onPreview(nextPayload)
                .then((nextPreview) => {
                  setPreview(nextPreview);
                  setResult("Preview rendered from D1 template.");
                })
                .catch((error: unknown) =>
                  setResult(error instanceof Error ? error.message : String(error)),
                );
            }}
          >
            Preview email
          </button>
          <button type="submit">Send event</button>
        </div>
        <div className="status compact">{result}</div>
      </form>
      <div className="panel previewPane">
        <h3>Email Preview</h3>
        {preview ? (
          <>
            <div className="previewMeta">
              <strong>To</strong>
              <span>{preview.to ?? payload.metadata.email}</span>
              <strong>Subject</strong>
              <span>{preview.subject}</span>
            </div>
            <iframe title="Email HTML preview" srcDoc={preview.html} />
            <pre>{preview.text}</pre>
          </>
        ) : (
          <div className="status compact">No preview rendered yet.</div>
        )}
      </div>
    </div>
  );
}

function titleForView(view: View): string {
  return {
    triggers: "Trigger Management",
    templates: "Template Editor",
    logs: "Delivery Logs",
    test: "Test Event Sender",
  }[view];
}
