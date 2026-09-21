import { IconButton } from "./button";
import { ListItem, showToast } from "./ui-lib";

import Locale from "../locales";
import { useAppConfig } from "../store/config";
import { useChatStore } from "../store/chat";
import { estimateCost } from "../utils/pricing";

export function EconomyConfig() {
  const config = useAppConfig();
  const chatStore = useChatStore();
  const L = Locale.Settings.Economy;

  const session = chatStore.currentSession();
  const promptTokens = Math.round(
    session?.stat?.promptTokens ?? session?.stat?.tokenCount ?? 0,
  );
  const completionTokens = Math.round(
    session?.stat?.completionTokens ?? 0,
  );
  const sessionCost = session
    ? estimateCost(
        session.mask.modelConfig.model,
        session.stat.promptTokens ?? 0,
        session.stat.completionTokens ?? 0,
      )
    : 0;

  function applyPreset() {
    config.update((c) => {
      c.modelConfig.historyMessageCount = 3;
      c.modelConfig.compressMessageLengthThreshold = 800;
      c.modelConfig.compactSystemPrompt = true;
      c.modelConfig.sendMemory = true;
    });
    const current = chatStore.currentSession();
    if (current) {
      chatStore.updateTargetSession(current, (s) => {
        s.mask.modelConfig.historyMessageCount = 3;
        s.mask.modelConfig.compressMessageLengthThreshold = 800;
        s.mask.modelConfig.compactSystemPrompt = true;
        s.mask.modelConfig.sendMemory = true;
      });
    }
    showToast(L.PresetApplied);
  }

  return (
    <>
      <ListItem title={L.Title} subTitle={L.SubTitle}>
        <IconButton text={L.Preset} bordered onClick={applyPreset} />
      </ListItem>
      <ListItem
        title={L.CompactSystemPrompt.Title}
        subTitle={L.CompactSystemPrompt.SubTitle}
      >
        <input
          aria-label={L.CompactSystemPrompt.Title}
          type="checkbox"
          checked={config.modelConfig.compactSystemPrompt ?? false}
          onChange={(e) => {
            const v = e.currentTarget.checked;
            config.update((c) => (c.modelConfig.compactSystemPrompt = v));
            const current = chatStore.currentSession();
            if (current) {
              chatStore.updateTargetSession(
                current,
                (s) => (s.mask.modelConfig.compactSystemPrompt = v),
              );
            }
          }}
        />
      </ListItem>
      <ListItem title={L.SessionStats.Title} subTitle={L.SessionStats.SubTitle}>
        <div style={{ fontSize: 12, textAlign: "right" }}>
          {L.Tokens(promptTokens + completionTokens)} • $
          {sessionCost.toFixed(4)}
        </div>
      </ListItem>
      <ListItem title={L.InputPrice.Title} subTitle={L.InputPrice.SubTitle}>
        <input
          aria-label={L.InputPrice.Title}
          type="number"
          min={0}
          step={0.01}
          value={config.tokenPricing.inputPer1M}
          onChange={(e) =>
            config.update(
              (c) =>
                (c.tokenPricing.inputPer1M =
                  parseFloat(e.currentTarget.value) || 0),
            )
          }
        />
      </ListItem>
      <ListItem title={L.OutputPrice.Title} subTitle={L.OutputPrice.SubTitle}>
        <input
          aria-label={L.OutputPrice.Title}
          type="number"
          min={0}
          step={0.01}
          value={config.tokenPricing.outputPer1M}
          onChange={(e) =>
            config.update(
              (c) =>
                (c.tokenPricing.outputPer1M =
                  parseFloat(e.currentTarget.value) || 0),
            )
          }
        />
      </ListItem>
      <ListItem
        title={L.PricingTable.Title}
        subTitle={L.PricingTable.SubTitle}
        vertical={true}
      >
        <textarea
          aria-label={L.PricingTable.Title}
          style={{
            width: "100%",
            maxWidth: "unset",
            textAlign: "left",
            fontFamily: "monospace",
            fontSize: 12,
            minHeight: 120,
          }}
          value={config.modelPricing}
          onChange={(e) =>
            config.update((c) => (c.modelPricing = e.currentTarget.value))
          }
        />
      </ListItem>
    </>
  );
}
