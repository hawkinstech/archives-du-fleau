import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        if (req.method === 'POST') {
            const { commentId, reporterId, reason } = req.body;
            await client.query(
                'INSERT INTO reports (comment_id, reporter_id, reason) VALUES ($1, $2, $3)',
                [commentId, reporterId, reason]
            );
            return res.status(200).json({ message: "Signalé" });
        }
        return res.status(405).json("Method error");
    } catch (e) { return res.status(500).json({ error: e.toString() }); } finally { await client.end(); }
}