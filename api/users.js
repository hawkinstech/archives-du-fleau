import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // --- RÉCUPÉRATION (GET) ---
        if (req.method === 'GET') {
            const { id, type } = req.query;

            if (type === 'list') {
                const result = await client.query('SELECT id, username, avatar_url, role, is_banned, is_muted, created_at FROM users ORDER BY id DESC');
                return res.status(200).json(result.rows);
            }

            if (id) {
                const result = await client.query('SELECT id, username, bio, avatar_url, role, is_banned, is_muted, created_at FROM users WHERE id = $1', [id]);
                if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
                return res.status(200).json(result.rows[0]);
            }

            return res.status(400).json({ error: "Paramètres manquants" });
        }

        // --- MODIFICATION (PUT) - ADMIN ---
        if (req.method === 'PUT') {
            const { userId, action, value } = req.body;
            
            if (action === 'set_role') {
                await client.query('UPDATE users SET role = $1 WHERE id = $2', [value, userId]);
                return res.status(200).json({ success: true });
            }
            if (action === 'ban') {
                await client.query('UPDATE users SET is_banned = $1 WHERE id = $2', [value, userId]);
                // NOTIFICATION SYSTÈME
                if (value === true) {
                    await client.query(
                        "INSERT INTO notifications (user_id, type, message) VALUES ($1, 'alert', 'Vous avez été BANNI par le Roi des Ténèbres.')",
                        [userId]
                    );
                }
                return res.status(200).json({ success: true });
            }
            if (action === 'mute') {
                await client.query('UPDATE users SET is_muted = $1 WHERE id = $2', [value, userId]);
                // NOTIFICATION SYSTÈME
                if (value === true) {
                    await client.query(
                        "INSERT INTO notifications (user_id, type, message) VALUES ($1, 'alert', 'Vous avez été réduit au silence (MUTE).')",
                        [userId]
                    );
                }
                return res.status(200).json({ success: true });
            }
        }

        // --- SUPPRESSION (DELETE) - SUPER ADMIN ---
        if (req.method === 'DELETE') {
            const { userId } = req.body;
            await client.query('DELETE FROM video_likes WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM comment_likes WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM comments WHERE target_user_id = $1 OR username = (SELECT username FROM users WHERE id = $1)', [userId]);
            await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]); // Nettoyage notifs
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json("Method Not Allowed");

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.toString() });
    } finally {
        await client.end();
    }
}