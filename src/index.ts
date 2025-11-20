import { Client as PgClient } from 'pg';
import { Client as NeonClient, neonConfig } from '@neondatabase/serverless';

async function runBenchmark(clientFactory: () => PgClient | NeonClient, runs: number = 10) {
	const connectionTimes: number[] = [];
	const queryTimes: number[] = [];
	const teardownTimes: number[] = [];
	const totalTimes: number[] = [];

	for (let i = 0; i < runs; i++) {
		const runStart = performance.now();

		// Create a new client for each run
		const client = clientFactory();

		// Measure connection establishment
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

		// Configure neonConfig for PlanetScale compatibility
		neonConfig.pipelineConnect = false;
		neonConfig.wsProxy = (host, port) => `${host}/v2?address=${host}:${port}`;

		const directWithPgbouncer = await runBenchmark(() => new PgClient({ connectionString: env.DATABASE_URL }), runs);
		const hyperdriveWithPgbouncer = await runBenchmark(
			() => new PgClient({ connectionString: env.HYPERDRIVE_WITH_PGBOUNCER.connectionString }),
			runs
		);
		const neonServerlessDriver = await runBenchmark(() => new NeonClient(env.DATABASE_URL), runs);

		return Response.json({
			runs,
			results: {
				directWithPgbouncer,
				hyperdriveWithPgbouncer,
				neonServerlessDriver,
			},
		});
	},
} satisfies ExportedHandler<Env>;
