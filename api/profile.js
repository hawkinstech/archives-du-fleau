import { Client } from 'pg';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        if (req.method === 'POST') {
            const { id, bio, avatar_url, new_username, new_password } = req.body;
            let query = '';
            let values = [];

            if (new_password && new_password.trim() !== "") {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(new_password, salt);
                query = 'UPDATE users SET bio = $1, avatar_url = $2, username = $3, password_hash = $4 WHERE id = $5 RETURNING id, username, bio, avatar_url, role';
                values = [bio, avatar_url, new_username, hash, id];
            } else {
                query = 'UPDATE users SET bio = $1, avatar_url = $2, username = $3 WHERE id = $4 RETURNING id, username, bio, avatar_url, role';
                values = [bio, avatar_url, new_username, id];
            }

            try {
                const result = await client.query(query, values);
                return res.status(200).json(result.rows[0]);
            } catch (err) {
                if (err.code === '23505') return res.status(400).json({ error: "Ce pseudo est déjà pris." });
                throw err;
            }
        }
        return res.status(405).json("Method Not Allowed");
    } catch (error) {
        return res.status(500).json({ error: error.toString() });
    } finally {
        await client.end();
    }
}