import { Client } from 'pg';

async function runBenchmark(connectionString: string, runs: number = 10) {
	const connectionTimes: number[] = [];
	const queryTimes: number[] = [];
	const teardownTimes: number[] = [];
	const totalTimes: number[] = [];

	for (let i = 0; i < runs; i++) {
		const runStart = performance.now();

		// Measure connection establishment
		const client = new Client({ connectionString });
		const connectStart = performance.now();
		await client.connect();
		const connectEnd = performance.now();
		connectionTimes.push(connectEnd - connectStart);

		// Run 10 queries per connection
		for (let j = 0; j < 10; j++) {
			// Measure query execution
			const queryStart = performance.now();
			await client.query(`SELECT * FROM games`);
			const queryEnd = performance.now();
			queryTimes.push(queryEnd - queryStart);
		}

		// Measure connection teardown
		const teardownStart = performance.now();
		await client.end();
		const teardownEnd = performance.now();
		teardownTimes.push(teardownEnd - teardownStart);

		const runEnd = performance.now();
		totalTimes.push(runEnd - runStart);
	}

	const averageQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
	const averageConnectionTime = connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length;
	const averageTeardownTime = teardownTimes.reduce((sum, time) => sum + time, 0) / teardownTimes.length;
	const averageTotalTime = totalTimes.reduce((sum, time) => sum + time, 0) / totalTimes.length;

	return {
		averageQueryTime,
		averageConnectionTime,
		averageTeardownTime,
		averageTotalTime,
	};
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const runs = parseInt(url.searchParams.get('runs') || '10', 10);

		const directWithPgbouncer = await runBenchmark(env.DATABASE_URL, runs);
		const hyperdriveWithPgbouncer = await runBenchmark(env.HYPERDRIVE_WITH_PGBOUNCER.connectionString, runs);

		return Response.json({
			runs,
			results: {
				directWithPgbouncer,
				hyperdriveWithPgbouncer,
			},
		});
	},
} satisfies ExportedHandler<Env>;
