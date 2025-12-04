import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        if (req.method === 'GET') {
            const { videoId, userId } = req.query;
            const counts = await client.query(
                `SELECT COUNT(*) FILTER (WHERE type = 'like') as likes, COUNT(*) FILTER (WHERE type = 'dislike') as dislikes FROM video_likes WHERE video_id = $1`,
                [videoId]
            );
            let userAction = null;
            if (userId) {
                const userStatus = await client.query('SELECT type FROM video_likes WHERE video_id = $1 AND user_id = $2', [videoId, userId]);
                if (userStatus.rows.length > 0) userAction = userStatus.rows[0].type;
            }
            return res.status(200).json({ stats: counts.rows[0], userAction });
        }

        if (req.method === 'POST') {
            const { videoId, userId, type } = req.body;
            await client.query(`INSERT INTO video_likes (video_id, user_id, type) VALUES ($1, $2, $3) ON CONFLICT (video_id, user_id) DO UPDATE SET type = EXCLUDED.type`, [videoId, userId, type]);
            return res.status(200).json("OK");
        }
    } catch (error) {
        return res.status(500).json({ error: error.toString() });
    } finally {
        await client.end();
    }
}