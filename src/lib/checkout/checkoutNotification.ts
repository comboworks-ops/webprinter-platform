export function checkoutNotificationNotice(notification: unknown): {message: string; warning: boolean} {
  const status = notification && typeof notification === "object" && "status" in notification
    ? notification.status : null;
  if (status === "accepted") {
    return {message: "Din ordrebekræftelse er afsendt. Tjek også spam, hvis den ikke dukker op.", warning: false};
  }
  if (status === "pending" || status === "processing") {
    return {message: "Din ordrebekræftelse er sat i kø til afsendelse. Du kan lukke denne side.", warning: false};
  }
  if (status === "failed" || status === "needs_review") {
    return {message: "Din ordre er gemt, men mailbekræftelsen kunne ikke bekræftes. Gem dit ordrenummer, og kontakt butikken ved spørgsmål.", warning: true};
  }
  return {message: "En automatisk mailbekræftelse er endnu ikke bekræftet. Gem dit ordrenummer ved spørgsmål.", warning: true};
}
