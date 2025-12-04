import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        if (req.method === 'GET') {
            const result = await client.query('SELECT * FROM videos ORDER BY created_at DESC');
            return res.status(200).json(result.rows);
        }

        if (req.method === 'POST') {
            const { title, description, url, thumbnail, categories, tags } = req.body;
            await client.query(
                'INSERT INTO videos (title, description, url, thumbnail, categories, tags) VALUES ($1, $2, $3, $4, $5, $6)',
                [title, description, url, thumbnail, categories, tags]
            );
            return res.status(200).json({ message: "Vidéo ajoutée" });
        }

        if (req.method === 'PUT') {
            const { id, title, description, url, thumbnail, categories, tags } = req.body;
            await client.query(
                'UPDATE videos SET title=$1, description=$2, url=$3, thumbnail=$4, categories=$5, tags=$6 WHERE id=$7',
                [title, description, url, thumbnail, categories, tags, id]
            );
            return res.status(200).json({ message: "Vidéo modifiée" });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            // Nettoyage complet
            await client.query('DELETE FROM video_likes WHERE video_id = $1', [id]);
            await client.query('DELETE FROM comments WHERE video_id = $1', [id]);
            await client.query('DELETE FROM videos WHERE id = $1', [id]);
            return res.status(200).json({ message: "Vidéo supprimée" });
        }

        return res.status(405).json("Method Not Allowed");
    } catch (error) {
        return res.status(500).json({ error: error.toString() });
    } finally {
        await client.end();
    }
}