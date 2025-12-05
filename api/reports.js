import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();

        // GET: Récupérer les signalements (Pour l'admin)
        if (req.method === 'GET') {
            const result = await client.query(`
                SELECT r.id, r.reason, r.created_at, 
                       u.username as reporter_name, 
                       c.content as comment_content, c.username as reported_username
                FROM reports r
                JOIN users u ON r.reporter_id = u.id
                JOIN comments c ON r.comment_id = c.id
                ORDER BY r.created_at DESC
            `);
            return res.status(200).json(result.rows);
        }

        // POST: Créer un signalement
        if (req.method === 'POST') {
            const { commentId, reporterId, reason } = req.body;
            await client.query(
                'INSERT INTO reports (comment_id, reporter_id, reason) VALUES ($1, $2, $3)',
                [commentId, reporterId, reason]
            );
            return res.status(200).json({ message: "Signalé" });
        }

        // DELETE: Supprimer/Résoudre un signalement
        if (req.method === 'DELETE') {
            const { id } = req.body;
            await client.query('DELETE FROM reports WHERE id = $1', [id]);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json("Method error");
    } catch (e) { return res.status(500).json({ error: e.toString() }); } finally { await client.end(); }
}