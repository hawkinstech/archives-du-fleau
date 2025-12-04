import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // RÉCUPÉRER LES NOTIFICATIONS (GET)
        if (req.method === 'GET') {
            const { userId } = req.query;
            if (!userId) return res.status(400).json({ error: "ID requis" });

            // On récupère les 20 dernières notifs
            const result = await client.query(
                'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
                [userId]
            );
            
            // On compte les non-lues
            const countResult = await client.query(
                'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
                [userId]
            );

            return res.status(200).json({ 
                list: result.rows, 
                unreadCount: parseInt(countResult.rows[0].count) 
            });
        }

        // MARQUER COMME LU (PUT)
        if (req.method === 'PUT') {
            const { notifId, userId } = req.body;
            
            if (notifId) {
                // Marquer une seule comme lue
                await client.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [notifId, userId]);
            } else {
                // Tout marquer comme lu
                await client.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
            }
            
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