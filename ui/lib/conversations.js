/** Only the bot's own console and channel conversations belong in this selector. */
export const chatConversations = (rows) => rows.filter((c) => c.channel !== "web" && !c.peerId?.startsWith("group:") && c.messageCount > 0);

export function initialConversation(rows, saved) {
  if (saved === "console" || rows.some((c) => c.id === saved)) return saved;
  const latest = rows.filter((c) => !c.peerId?.startsWith("group:") && c.messageCount > 0).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return latest && latest.channel !== "web" ? latest.id : "console";
}

export function mergeMessages(current, incoming) {
  if (!incoming.length) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
