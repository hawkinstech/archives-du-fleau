import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        if (req.method === 'GET') {
            const { videoId, targetUserId } = req.query;
            let query = `
                SELECT c.*, u.avatar_url, u.id as author_id,
                (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count
                FROM comments c
                LEFT JOIN users u ON c.username = u.username 
            `;
            let values = [];
            if (videoId) { query += ` WHERE c.video_id = $1`; values.push(videoId); }
            else if (targetUserId) { query += ` WHERE c.target_user_id = $1`; values.push(targetUserId); }
            else return res.status(400).json("Missing params");

            query += ` ORDER BY c.created_at DESC`;
            const result = await client.query(query, values);
            return res.status(200).json(result.rows);
        } 
        
        if (req.method === 'POST') {
            const data = req.body;
            const userCheck = await client.query('SELECT is_banned, is_muted FROM users WHERE username = $1', [data.username]);
            if (userCheck.rows.length > 0) {
                const u = userCheck.rows[0];
                if (u.is_banned) return res.status(403).json({ error: "Vous êtes banni." });
                if (u.is_muted) return res.status(403).json({ error: "Vous êtes réduit au silence." });
            }

            await client.query(
                'INSERT INTO comments (video_id, target_user_id, parent_id, username, content) VALUES ($1, $2, $3, $4, $5)',
                [data.videoId || null, data.targetUserId || null, data.parentId || null, data.username, data.content]
            );
            return res.status(200).json({ message: "Succès" });
        }

        if (req.method === 'PUT') {
             const { commentId, userId } = req.body;
             await client.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [commentId, userId]);
             return res.status(200).json({ message: "Liked" });
        }

        if (req.method === 'DELETE') {
            const { commentId } = req.body;
            await client.query('DELETE FROM comments WHERE id = $1', [commentId]);
            await client.query('DELETE FROM comments WHERE parent_id = $1', [commentId]);
            return res.status(200).json("Deleted");
        }

        return res.status(405).json("Method Not Allowed");
    } catch (error) {
        return res.status(500).json({ error: error.toString() });
    } finally {
        await client.end();
    }
}