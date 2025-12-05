import { Client } from 'pg';

export default async function handler(req, res) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();

        // GET: Récupérer le duel
        if (req.method === 'GET') {
            const { videoId, userId } = req.query;
            
            const result = await client.query('SELECT * FROM duels WHERE video_id = $1', [videoId]);
            
            // MODIFICATION : On ne crée plus automatiquement le duel. S'il n'y en a pas, on renvoie null.
            if (result.rows.length === 0) {
                return res.status(200).json({ duel: null, userVote: null });
            }
            
            const duel = result.rows[0];
            let userVote = null;
            if (userId) {
                const voteCheck = await client.query('SELECT team FROM duel_votes WHERE duel_id = $1 AND user_id = $2', [duel.id, userId]);
                if (voteCheck.rows.length > 0) userVote = voteCheck.rows[0].team;
            }

            return res.status(200).json({ duel, userVote });
        }

        // POST: Voter OU Créer/Modifier (Admin)
        if (req.method === 'POST') {
            const { action } = req.body;

            // ACTION 1 : VOTER (Pour tout le monde)
            if (action === 'vote') {
                const { duelId, userId, team } = req.body;
                const check = await client.query('SELECT * FROM duel_votes WHERE duel_id = $1 AND user_id = $2', [duelId, userId]);
                if (check.rows.length > 0) return res.status(400).json({ error: "Déjà voté" });

                await client.query('INSERT INTO duel_votes (duel_id, user_id, team) VALUES ($1, $2, $3)', [duelId, userId, team]);
                if (team === 'red') await client.query('UPDATE duels SET red_score = red_score + 1 WHERE id = $1', [duelId]);
                else await client.query('UPDATE duels SET blue_score = blue_score + 1 WHERE id = $1', [duelId]);
                return res.status(200).json({ success: true });
            }

            // ACTION 2 : CRÉER / METTRE À JOUR LE DUEL (Admin via l'éditeur)
            if (action === 'upsert') {
                const { videoId, redName, blueName } = req.body;
                // On essaie d'insérer, si ça existe déjà (conflit sur video_id), on met à jour les noms
                await client.query(`
                    INSERT INTO duels (video_id, red_name, blue_name) 
                    VALUES ($1, $2, $3)
                    ON CONFLICT (video_id) 
                    DO UPDATE SET red_name = EXCLUDED.red_name, blue_name = EXCLUDED.blue_name
                `, [videoId, redName || 'Rouge', blueName || 'Bleu']);
                return res.status(200).json({ success: true });
            }
            
            // ACTION 3 : SUPPRIMER UN DUEL (Si on décoche la case)
            if (action === 'delete') {
                const { videoId } = req.body;
                await client.query('DELETE FROM duels WHERE video_id = $1', [videoId]);
                return res.status(200).json({ success: true });
            }
        }
        
        return res.status(405).json("Method error");
    } catch (e) { return res.status(500).json({ error: e.toString() }); } finally { await client.end(); }
}