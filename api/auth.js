import { Client } from 'pg';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const { type } = req.query; 
        const { username, password } = req.body;

        // --- INSCRIPTION ---
        if (type === 'signup') {
            const checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (checkUser.rows.length > 0) {
                return res.status(400).json({ error: "Ce pseudo est déjà pris." });
            }

            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            const result = await client.query(
                'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, bio, avatar_url, role',
                [username, hash, 'user']
            );
            return res.status(200).json(result.rows[0]);
        }

        // --- CONNEXION ---
        if (type === 'login') {
            const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
            if (result.rows.length === 0) {
                return res.status(400).json({ error: "Utilisateur introuvable." });
            }
            const user = result.rows[0];

            // MODIFICATION ICI : On a retiré le bloc qui bloquait les bannis (return 403).
            // L'utilisateur peut se connecter, le front-end bloquera l'accès aux vidéos.

            const validPass = await bcrypt.compare(password, user.password_hash);
            if (!validPass) {
                return res.status(400).json({ error: "Mot de passe incorrect." });
            }

            const userInfo = { 
                id: user.id, 
                username: user.username, 
                bio: user.bio, 
                avatar_url: user.avatar_url,
                role: user.role,
                is_banned: user.is_banned, // On renvoie l'info pour l'affichage
                is_muted: user.is_muted    // On renvoie l'info pour les commentaires
            };
            return res.status(200).json(userInfo);
        }

        return res.status(400).json({ error: "Action non reconnue" });

    } catch (error) {
        return res.status(500).json({ error: error.toString() });
    } finally {
        await client.end();
    }
}