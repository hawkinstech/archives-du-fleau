import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();

        // GET: Récupérer les infos du duel pour une vidéo
        if (req.method === 'GET') {
            const { videoId, userId } = req.query;
            
            // Cherche le duel, s'il n'existe pas, on le crée à la volée (Lazy creation)
            let result = await client.query('SELECT * FROM duels WHERE video_id = $1', [videoId]);
            
            if (result.rows.length === 0) {
                // Création automatique d'un duel vide
                result = await client.query(
                    "INSERT INTO duels (video_id, red_name, blue_name) VALUES ($1, 'Team Rouge', 'Team Bleu') RETURNING *",
                    [videoId]
                );
            }
            
            const duel = result.rows[0];
            let userVote = null;
            
            if (userId) {
                const voteCheck = await client.query('SELECT team FROM duel_votes WHERE duel_id = $1 AND user_id = $2', [duel.id, userId]);
                if (voteCheck.rows.length > 0) userVote = voteCheck.rows[0].team;
            }

            return res.status(200).json({ duel, userVote });
        }

        // POST: Voter
        if (req.method === 'POST') {
            const { duelId, userId, team } = req.body;
            
            // Vérifier si déjà voté
            const check = await client.query('SELECT * FROM duel_votes WHERE duel_id = $1 AND user_id = $2', [duelId, userId]);
            if (check.rows.length > 0) return res.status(400).json({ error: "Déjà voté" });

            // Enregistrer le vote
            await client.query('INSERT INTO duel_votes (duel_id, user_id, team) VALUES ($1, $2, $3)', [duelId, userId, team]);
            
            // Mettre à jour le score
            if (team === 'red') await client.query('UPDATE duels SET red_score = red_score + 1 WHERE id = $1', [duelId]);
            else await client.query('UPDATE duels SET blue_score = blue_score + 1 WHERE id = $1', [duelId]);

            return res.status(200).json({ success: true });
        }
        
        return res.status(405).json("Method error");
    } catch (e) { return res.status(500).json({ error: e.toString() }); } finally { await client.end(); }
}