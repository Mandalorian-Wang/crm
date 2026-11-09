export const LINEAR = {
	endpoint: "https://api.linear.app/graphql",
	timeoutMs: 15_000,
	uploadTimeoutMs: 60_000,
	pageSize: 50,
	maxPages: 100,
	fields: {
		id: "linear_customer_id",
		name: "linear_customer_name",
		url: "linear_url",
	},
} as const;
