// server.js — backend da loja, sem dependências externas (só Node.js puro)
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 3000;
// Senha simples de admin — troque isso antes de publicar de verdade.
const ADMIN_KEY = process.env.ADMIN_KEY || 'tdh123';

// Credenciais do Mercado Pago — ficam vazias até você colar as suas.
// Nunca coloque a chave direto no código: sempre passe como variável de ambiente.
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function isAdmin(req) {
  return req.headers['x-admin-key'] === ADMIN_KEY;
}

function serveStatic(req, res, urlPath) {
  const filePath = path.join(__dirname, 'public', urlPath === '/' ? 'loja.html' : urlPath);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Proibido');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Não encontrado');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean); // ex: ['api','products','buf1']

  if (req.method === 'OPTIONS') {
    return sendJSON(res, 204, {});
  }

  // ---------- API ----------
  if (parts[0] === 'api' && parts[1] === 'products') {
    const id = parts[2];

    // GET /api/products -> lista todos
    if (req.method === 'GET' && !id) {
      const rows = db.prepare('SELECT * FROM products ORDER BY category, name').all();
      return sendJSON(res, 200, rows);
    }

    // POST /api/products -> cria produto (precisa de x-admin-key)
    if (req.method === 'POST' && !id) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      try {
        const body = await readBody(req);
        const { id: newId, category, name, description, price, icon, image } = body;
        if (!newId || !category || !name || price == null) {
          return sendJSON(res, 400, { error: 'Campos obrigatórios: id, category, name, price' });
        }
        db.prepare(
          'INSERT INTO products (id, category, name, description, price, icon, image) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(newId, category, name, description || '', price, icon || '🎉', image || null);
        return sendJSON(res, 201, { ok: true });
      } catch (e) {
        return sendJSON(res, 400, { error: 'JSON inválido ou id duplicado' });
      }
    }

    // PUT /api/products/:id -> edita produto (precisa de x-admin-key)
    if (req.method === 'PUT' && id) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      try {
        const body = await readBody(req);
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) return sendJSON(res, 404, { error: 'Produto não encontrado' });
        const updated = { ...existing, ...body };
        db.prepare(
          'UPDATE products SET category=?, name=?, description=?, price=?, icon=?, image=? WHERE id=?'
        ).run(updated.category, updated.name, updated.description, updated.price, updated.icon, updated.image || null, id);
        return sendJSON(res, 200, { ok: true });
      } catch (e) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // DELETE /api/products/:id -> remove produto (precisa de x-admin-key)
    if (req.method === 'DELETE' && id) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      if (result.changes === 0) return sendJSON(res, 404, { error: 'Produto não encontrado' });
      return sendJSON(res, 200, { ok: true });
    }
  }

  // POST /api/login -> valida a senha de admin
  if (parts[0] === 'api' && parts[1] === 'login' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.key === ADMIN_KEY) return sendJSON(res, 200, { ok: true });
    return sendJSON(res, 401, { ok: false });
  }

  // ---------- PEDIDOS ----------
  if (parts[0] === 'api' && parts[1] === 'orders') {
    const orderId = parts[2];

    // POST /api/orders -> cliente finaliza a compra (não precisa de senha)
    if (req.method === 'POST' && !orderId) {
      try {
        const body = await readBody(req);
        const { customerName, phone, address, partyDate, paymentMethod, total, items } = body;
        if (!customerName || !phone || !address || total == null || !Array.isArray(items) || items.length === 0) {
          return sendJSON(res, 400, { error: 'Dados do pedido incompletos' });
        }
        const newOrderId = 'TDH-' + Math.floor(10000 + Math.random() * 89999);
        db.prepare(
          `INSERT INTO orders (id, created_at, customer_name, phone, address, party_date, payment_method, total, status, items)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recebido', ?)`
        ).run(
          newOrderId,
          new Date().toISOString(),
          customerName,
          phone,
          address,
          partyDate || null,
          paymentMethod || null,
          total,
          JSON.stringify(items)
        );
        console.log(`[PEDIDO RECEBIDO] ${newOrderId} — ${customerName} — R$ ${total}`);
        const checkCount = db.prepare('SELECT COUNT(*) AS n FROM orders').get();
        console.log(`[CONFERINDO BANCO] total de pedidos agora: ${checkCount.n} (arquivo: ${require('path').join(__dirname, 'loja.db')})`);
        return sendJSON(res, 201, { ok: true, orderId: newOrderId });
      } catch (e) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // GET /api/orders -> lista todos os pedidos (admin)
    if (req.method === 'GET' && !orderId) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
      console.log(`[ADMIN CONSULTOU PEDIDOS] encontrados: ${rows.length} (arquivo: ${require('path').join(__dirname, 'loja.db')})`);
      const parsed = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
      return sendJSON(res, 200, parsed);
    }

    // PUT /api/orders/:id -> atualiza status do pedido (admin)
    if (req.method === 'PUT' && orderId) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      try {
        const body = await readBody(req);
        const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        if (!existing) return sendJSON(res, 404, { error: 'Pedido não encontrado' });
        const newStatus = body.status || existing.status;
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, orderId);
        return sendJSON(res, 200, { ok: true });
      } catch (e) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }
  }

  // ---------- SOLICITAÇÕES DE CONSERTO ----------
  if (parts[0] === 'api' && parts[1] === 'repairs') {
    const repairId = parts[2];

    // POST /api/repairs -> cliente envia uma solicitação (não precisa de senha)
    if (req.method === 'POST' && !repairId) {
      try {
        const body = await readBody(req);
        const { customerName, phone, serviceType, description } = body;
        if (!customerName || !phone || !description) {
          return sendJSON(res, 400, { error: 'Preencha nome, telefone e descrição do serviço' });
        }
        const newRepairId = 'TDH-C' + Math.floor(1000 + Math.random() * 8999);
        db.prepare(
          `INSERT INTO repairs (id, created_at, customer_name, phone, service_type, description, status)
           VALUES (?, ?, ?, ?, ?, ?, 'novo')`
        ).run(newRepairId, new Date().toISOString(), customerName, phone, serviceType || null, description);
        console.log(`[CONSERTO RECEBIDO] ${newRepairId} — ${customerName}`);
        return sendJSON(res, 201, { ok: true, repairId: newRepairId });
      } catch (e) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // GET /api/repairs -> lista todas as solicitações (admin)
    if (req.method === 'GET' && !repairId) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      const rows = db.prepare('SELECT * FROM repairs ORDER BY created_at DESC').all();
      return sendJSON(res, 200, rows);
    }

    // PUT /api/repairs/:id -> atualiza status da solicitação (admin)
    if (req.method === 'PUT' && repairId) {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Senha de admin inválida' });
      try {
        const body = await readBody(req);
        const existing = db.prepare('SELECT * FROM repairs WHERE id = ?').get(repairId);
        if (!existing) return sendJSON(res, 404, { error: 'Solicitação não encontrada' });
        const newStatus = body.status || existing.status;
        db.prepare('UPDATE repairs SET status = ? WHERE id = ?').run(newStatus, repairId);
        return sendJSON(res, 200, { ok: true });
      } catch (e) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }
  }

  // ---------- PAGAMENTO (MERCADO PAGO) ----------

  // POST /api/checkout/create-preference -> gera o link de pagamento pra um pedido já criado
  if (parts[0] === 'api' && parts[1] === 'checkout' && parts[2] === 'create-preference' && req.method === 'POST') {
    if (!MP_ACCESS_TOKEN) {
      // Sem credenciais configuradas ainda — avisa o frontend pra usar o modo simulado.
      return sendJSON(res, 200, { configured: false });
    }
    try {
      const body = await readBody(req);
      const { orderId } = body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return sendJSON(res, 404, { error: 'Pedido não encontrado' });

      const items = JSON.parse(order.items).map(it => ({
        id: it.id,
        title: it.name,
        quantity: it.qty,
        unit_price: it.price,
        currency_id: 'BRL'
      }));

      const preferenceBody = {
        items,
        external_reference: order.id,
        back_urls: {
          success: `${SITE_URL}/?pedido=${order.id}&status=sucesso`,
          failure: `${SITE_URL}/?pedido=${order.id}&status=falha`,
          pending: `${SITE_URL}/?pedido=${order.id}&status=pendente`
        },
        // auto_return exige back_urls.success público em HTTPS — não funciona com localhost.
        // Quando o site estiver publicado de verdade (com domínio HTTPS), pode reativar:
        // auto_return: 'approved',
        notification_url: `${SITE_URL}/api/webhooks/mercadopago`
      };

      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        },
        body: JSON.stringify(preferenceBody)
      });
      const mpData = await mpRes.json();

      if (!mpRes.ok) {
        console.log('[MERCADO PAGO] erro ao criar preferência:', JSON.stringify(mpData));
        return sendJSON(res, 502, { error: 'Erro ao criar preferência no Mercado Pago', details: mpData });
      }

      console.log(`[MERCADO PAGO] preferência criada para o pedido ${order.id}`);
      return sendJSON(res, 200, {
        configured: true,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point
      });
    } catch (e) {
      console.log('[MERCADO PAGO] erro inesperado:', e.message);
      return sendJSON(res, 500, { error: 'Erro inesperado ao criar pagamento' });
    }
  }

  // POST /api/webhooks/mercadopago -> o Mercado Pago avisa aqui quando um pagamento muda de status
  if (parts[0] === 'api' && parts[1] === 'webhooks' && parts[2] === 'mercadopago') {
    if (req.method === 'GET') return sendJSON(res, 200, { ok: true }); // health check
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const paymentId = body?.data?.id || url.searchParams.get('id');
        const topic = body?.type || url.searchParams.get('topic');

        if (topic !== 'payment' || !paymentId) {
          return sendJSON(res, 200, { ok: true }); // ignora outros tipos de notificação
        }

        const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
        });
        const payment = await payRes.json();
        const orderId = payment.external_reference;
        const mpStatus = payment.status; // approved, pending, in_process, rejected, cancelled...

        const statusMap = { approved: 'confirmado', rejected: 'cancelado', cancelled: 'cancelado' };
        const newStatus = statusMap[mpStatus] || 'recebido';

        if (orderId) {
          db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, orderId);
          console.log(`[MERCADO PAGO] webhook: pedido ${orderId} -> ${mpStatus} (status interno: ${newStatus})`);
        }
        return sendJSON(res, 200, { ok: true });
      } catch (e) {
        console.log('[MERCADO PAGO] erro no webhook:', e.message);
        return sendJSON(res, 200, { ok: true }); // sempre responde 200 pro Mercado Pago não ficar reenviando
      }
    }
  }

  // ---------- ARQUIVOS ESTÁTICOS (site + admin) ----------
  if (req.method === 'GET') {
    return serveStatic(req, res, url.pathname);
  }

  sendJSON(res, 404, { error: 'Rota não encontrada' });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Painel admin em http://localhost:${PORT}/admin.html (senha: ${ADMIN_KEY})`);
  if (MP_ACCESS_TOKEN) {
    console.log('[MERCADO PAGO] credenciais configuradas — pagamento real ativo.');
  } else {
    console.log('[MERCADO PAGO] sem credenciais ainda — checkout continua em modo simulado.');
    console.log('  Para ativar, rode: set MP_ACCESS_TOKEN=SEU_TOKEN && node server.js');
  }
});
