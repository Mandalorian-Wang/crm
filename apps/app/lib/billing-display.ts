const billingTime = new Intl.DateTimeFormat("zh-CN", {
	timeZone: "Asia/Shanghai",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

export function billingTimestamp(value: string): string {
	const date = new Date(value);
	return Number.isFinite(date.getTime())
		? `${billingTime.format(date)}（北京时间）`
		: "—";
}

export function billingWindow(value: string): string {
	const parts = value.split("→").map((part) => new Date(part.trim()));
	if (
		!parts[0] ||
		!parts[1] ||
		parts.length !== 2 ||
		parts.some((date) => !Number.isFinite(date.getTime()))
	)
		return "—";
	return `${billingTime.format(parts[0])} — ${billingTime.format(parts[1])}（北京时间）`;
}
