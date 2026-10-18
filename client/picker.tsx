import type { PluginAgentPanelProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { switchSession } from "../shared/convert";

// A panel, not a popover: only panels receive `navigation`, which is how the new agent gets focused.
export function SwitchPanel({ theme, agentId, navigation }: PluginAgentPanelProps) {
  const paseo = usePaseo();
  const switchRpc = useRpc(switchSession);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["switch-provider", "catalog"],
    queryFn: async () => {
      const { entries } = await paseo.providers.snapshot();
      return entries.filter((entry) => entry.enabled && entry.status === "ready");
    },
  });
  const styles = useMemo(
    () => ({
      box: { padding: 16, gap: 4 },
      heading: { color: theme.colors.foregroundMuted, padding: 8 },
      row: { padding: 10, borderRadius: 8 },
      text: { color: theme.colors.foreground },
    }),
    [theme],
  );
  async function pick(provider: string, modelId: string) {
    setError(null);
    setBusy(true);
    try {
      const created = await switchRpc({ agentId, provider, modelId });
      navigation?.openAgent({ agentId: created.agentId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
      return;
    }
    setBusy(false);
  }
  const provider = catalog.data?.find((entry) => entry.provider === chosen);
  const rows = provider
    ? (provider.models ?? [])
        .filter((model) => model.isSelectable !== false)
        .map((model) => ({ key: model.id, label: model.label, onPress: () => pick(provider.provider, model.id) }))
    : (catalog.data ?? []).map((entry) => ({
        key: entry.provider,
        label: entry.label ?? entry.provider,
        onPress: () => setChosen(entry.provider),
      }));
  let heading = error ?? "Choose a provider";
  if (error) heading = error;
  else if (busy) heading = "Switching…";
  else if (catalog.isPending) heading = "Loading providers…";
  else if (catalog.isError) heading = "Could not load providers";
  else if (provider) heading = `${provider.label ?? provider.provider}: choose a model`;
  return (
    <ScrollView contentContainerStyle={styles.box}>
      <Text style={styles.heading}>{heading}</Text>
      {provider ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to providers" style={styles.row} onPress={() => setChosen(null)}>
          <Text style={styles.text}>← Providers</Text>
        </Pressable>
      ) : null}
      {rows.map((row) => (
        <Pressable key={row.key} accessibilityRole="button" accessibilityLabel={row.label} style={styles.row} onPress={row.onPress}>
          <Text style={styles.text}>{row.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
