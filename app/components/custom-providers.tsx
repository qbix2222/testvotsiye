import { useState } from "react";

import AddIcon from "../icons/add.svg";
import { IconButton } from "./button";
import {
  ListItem,
  Modal,
  PasswordInput,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";

import Locale from "../locales";
import { useAccessStore, type CustomProvider } from "../store/access";
import { useAppConfig } from "../store/config";
import {
  customModelsFromIds,
  fetchCustomModelIds,
} from "../utils/custom-provider";

type EditorState =
  | { mode: "new" }
  | { mode: "edit"; provider: CustomProvider }
  | null;

function ProviderEditor(props: {
  state: Exclude<EditorState, null>;
  onClose: () => void;
}) {
  const accessStore = useAccessStore();
  const L = Locale.Settings.Access.CustomProviders;
  const editing = props.state.mode === "edit" ? props.state.provider : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(editing?.apiKey ?? "");
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [useProxy, setUseProxy] = useState(editing?.useProxy ?? true);
  const [testing, setTesting] = useState(false);

  async function onTest() {
    if (!baseUrl.trim()) {
      showToast(L.NeedEndpoint);
      return;
    }
    setTesting(true);
    try {
      const ids = await fetchCustomModelIds({
        id: editing?.id ?? "tmp",
        name: name.trim() || "tmp",
        baseUrl: baseUrl.trim(),
        apiKey,
        enabled: true,
        useProxy,
      });
      showToast(L.TestOk(ids.length));
    } catch (e: any) {
      showToast(L.TestFail(e?.message || String(e)));
    } finally {
      setTesting(false);
    }
  }

  function onSave() {
    if (!name.trim()) {
      showToast(L.NeedName);
      return;
    }
    if (!baseUrl.trim()) {
      showToast(L.NeedEndpoint);
      return;
    }
    if (editing) {
      accessStore.updateCustomProvider(editing.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey,
        enabled,
        useProxy,
      });
    } else {
      const created = accessStore.addCustomProvider({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey,
        useProxy,
      });
      if (!created) {
        showToast(L.DupName);
        return;
      }
      if (!enabled) {
        accessStore.updateCustomProvider(created.id, { enabled: false });
      }
    }
    props.onClose();
  }

  return (
    <div
      className="modal-mask"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <Modal
        title={editing ? L.EditTitle : L.AddTitle}
        onClose={props.onClose}
        actions={[
          <IconButton
            key="test"
            text={testing ? "..." : L.Test}
            bordered
            onClick={onTest}
          />,
          <IconButton
            key="save"
            text={L.Save}
            type="primary"
            bordered
            onClick={onSave}
          />,
        ]}
      >
        <div>
          <ListItem title={L.Name}>
            <input
              type="text"
              value={name}
              placeholder={L.NamePlaceholder}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </ListItem>
          <ListItem title={L.Endpoint} subTitle={L.EndpointSub}>
            <input
              type="text"
              value={baseUrl}
              placeholder={L.EndpointPlaceholder}
              onChange={(e) => setBaseUrl(e.currentTarget.value)}
            />
          </ListItem>
          <ListItem title={L.ApiKey}>
            <PasswordInput
              value={apiKey}
              type="text"
              onChange={(e) => setApiKey(e.currentTarget.value)}
            />
          </ListItem>
          <ListItem title={L.Enabled}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
            />
          </ListItem>
          <ListItem title={L.UseProxy} subTitle={L.UseProxySub}>
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(e) => setUseProxy(e.currentTarget.checked)}
            />
          </ListItem>
        </div>
      </Modal>
    </div>
  );
}

export function CustomProviders() {
  const accessStore = useAccessStore();
  const config = useAppConfig();
  const L = Locale.Settings.Access.CustomProviders;
  const [editor, setEditor] = useState<EditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const providers = accessStore.customProviders || [];

  function modelCount(p: CustomProvider) {
    return config.models.filter(
      (m) => m.provider?.id === p.id && m.available !== false,
    ).length;
  }

  function providerIndex(p: CustomProvider) {
    return Math.max(
      providers.findIndex((x) => x.id === p.id),
      0,
    );
  }

  async function onFetchModels(p: CustomProvider) {
    setBusyId(p.id);
    try {
      const ids = await fetchCustomModelIds(p);
      if (ids.length === 0) {
        showToast(L.FetchEmpty);
        return;
      }
      config.upsertModels(customModelsFromIds(ids, p, providerIndex(p)));
      showToast(L.FetchOk(ids.length));
    } catch (e: any) {
      showToast(L.TestFail(e?.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function onAddModel(p: CustomProvider) {
    const id = (await showPrompt(L.AddModelPrompt, "", 1))?.trim();
    if (!id) return;
    config.upsertModels(customModelsFromIds([id], p, providerIndex(p)));
    showToast(L.ModelAdded(id));
  }

  async function onDelete(p: CustomProvider) {
    if (!(await showConfirm(L.DeleteConfirm))) return;
    const mine = config.models.filter((m) => m.provider?.id === p.id);
    if (mine.length > 0) config.upsertModels(mine, false);
    accessStore.removeCustomProvider(p.id);
  }

  return (
    <>
      <ListItem title={L.Title} subTitle={L.SubTitle}>
        <IconButton
          icon={<AddIcon />}
          text={L.Add}
          bordered
          onClick={() => setEditor({ mode: "new" })}
        />
      </ListItem>
      {providers.map((p) => (
        <ListItem
          key={p.id}
          title={`${p.enabled === false ? "⏸ " : ""}${p.name}`}
          subTitle={`${p.baseUrl} • ${L.ModelsCount(modelCount(p))}`}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <input
              aria-label={L.Enabled}
              type="checkbox"
              checked={p.enabled !== false}
              onChange={(e) =>
                accessStore.updateCustomProvider(p.id, {
                  enabled: e.currentTarget.checked,
                })
              }
            />
            <IconButton
              text={busyId === p.id ? "..." : L.FetchModels}
              bordered
              disabled={busyId !== null}
              onClick={() => onFetchModels(p)}
            />
            <IconButton
              text={L.AddModel}
              bordered
              onClick={() => onAddModel(p)}
            />
            <IconButton
              text={L.Edit}
              bordered
              onClick={() => setEditor({ mode: "edit", provider: p })}
            />
            <IconButton
              text={L.Delete}
              type="danger"
              bordered
              onClick={() => onDelete(p)}
            />
          </div>
        </ListItem>
      ))}
      {editor && (
        <ProviderEditor state={editor} onClose={() => setEditor(null)} />
      )}
    </>
  );
}
