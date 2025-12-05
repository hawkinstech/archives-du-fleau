import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        if (req.method === 'GET') {
            const { userId } = req.query;
            if (!userId) return res.status(400).json({ error: "ID requis" });

            // On vérifie d'abord si la table existe (au cas où)
            const result = await client.query(
                'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
                [userId]
            );
            
            const countResult = await client.query(
                'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
                [userId]
            );

            return res.status(200).json({ 
                list: result.rows, 
                unreadCount: parseInt(countResult.rows[0].count) 
            });
        }

        if (req.method === 'PUT') {
            const { notifId, userId } = req.body;
            if (notifId) {
                await client.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [notifId, userId]);
            } else {
                await client.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
            }
            return res.status(200).json({ success: true });
        }

        return res.status(405).json("Method Not Allowed");
    } catch (error) {
        console.error("Erreur API Notifs:", error);
        // On renvoie une liste vide en cas d'erreur pour ne pas casser le site
        return res.status(200).json({ list: [], unreadCount: 0 });
    } finally {
        await client.end();
    }
}