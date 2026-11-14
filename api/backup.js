/* Méridien — sauvegarde cloud. Le serveur ne voit jamais le clair :
   le payload est chiffré côté client (AES-GCM) avant envoi. */
'use strict';

const { put, list } = require('@vercel/blob');

const BLOB_NAME = 'meridien-backup.json';
const BLOB_PREFIX = 'meridien-backup';

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      const payload = body && typeof body.payload === 'string' ? body.payload : null;
      if (!payload) {
        res.status(400).json({ error: 'Payload manquant' });
        return;
      }
      const buf = Buffer.from(payload, 'base64');
      if (!buf.length) {
        res.status(400).json({ error: 'Payload base64 invalide' });
        return;
      }
      await put(BLOB_NAME, buf, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/octet-stream'
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: BLOB_PREFIX });
      if (!blobs || !blobs.length) {
        res.status(404).json({ error: 'Aucune sauvegarde' });
        return;
      }
      const latest = blobs.slice().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const upstream = await fetch(latest.url);
      if (!upstream.ok) {
        res.status(502).json({ error: 'Lecture de la sauvegarde impossible' });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buf);
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err || 'Erreur serveur') });
  }
};
