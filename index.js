import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const senhaMestre = process.env.SENHA_MESTRE;

if (!serviceAccountJson) {
  console.error("Faltou configurar a variável de ambiente FIREBASE_SERVICE_ACCOUNT_JSON.");
}
if (!senhaMestre) {
  console.error("Faltou configurar a variável de ambiente SENHA_MESTRE.");
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountJson || "{}")),
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor de notificações do Monster Hearts está no ar. 🎭");
});

app.post("/enviar-notificacao", async (req, res) => {
  const { texto, senha } = req.body || {};

  if (!texto || typeof texto !== "string") {
    return res.status(400).json({ erro: "O campo 'texto' é obrigatório." });
  }
  if (!senhaMestre || senha !== senhaMestre) {
    return res.status(403).json({ erro: "Senha incorreta." });
  }

  try {
    const instantaneo = await db.collection("tokens").get();
    const tokens = instantaneo.docs.map((d) => d.id).filter(Boolean);

    if (tokens.length === 0) {
      return res.json({ ok: true, enviados: 0, aviso: "Nenhum aparelho cadastrado ainda." });
    }

    const resposta = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "🎭 Aviso do Mestre",
        body: texto,
      },
    });

    const paraRemover = [];
    resposta.responses.forEach((r, i) => {
      if (!r.success) paraRemover.push(tokens[i]);
    });
    await Promise.all(
      paraRemover.map((token) => db.collection("tokens").doc(token).delete().catch(() => {}))
    );

    res.json({
      ok: true,
      enviados: resposta.successCount,
      falhas: resposta.failureCount,
    });
  } catch (erro) {
    console.error("Erro ao enviar notificações:", erro);
    res.status(500).json({ erro: "Erro ao enviar notificações." });
  }
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log(`Servidor de notificações rodando na porta ${porta}`));
