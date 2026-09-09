// db.js — banco de dados SQLite embutido no Node.js (sem instalar nada extra)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'loja.db');
const db = new DatabaseSync(dbPath);

// Tabela de produtos
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    icon TEXT NOT NULL,
    image TEXT
  )
`);

const columns = db.prepare("PRAGMA table_info(products)").all();
const hasImageColumn = columns.some(c => c.name === 'image');
if (!hasImageColumn) {
  db.exec('ALTER TABLE products ADD COLUMN image TEXT');
  console.log('Coluna "image" adicionada ao banco existente.');
}

// Tabela de pedidos (produtos físicos)
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    party_date TEXT,
    payment_method TEXT,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'recebido',
    items TEXT NOT NULL
  )
`);

// Tabela de solicitações de conserto (não é compra — é pedido de orçamento/agendamento)
db.exec(`
  CREATE TABLE IF NOT EXISTS repairs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_type TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'novo'
  )
`);

// Produtos iniciais fictícios (só entram se a tabela estiver vazia) — troque pelos produtos reais depois.
const SEED = [
  // ARMARINHO
  { id: 'arm1', category: 'armarinho', name: 'Kit linhas coloridas (20un)', description: 'Linhas de costura em algodão, cores variadas para bordado e ajustes.', price: 28, icon: '🧵' },
  { id: 'arm2', category: 'armarinho', name: 'Cartela de botões sortidos', description: '50 botões em madrepérola, madeira e plástico, tamanhos variados.', price: 15, icon: '🔘' },
  { id: 'arm3', category: 'armarinho', name: 'Kit zíperes (5un)', description: 'Zíperes de nylon em cores básicas, 20cm, prontos para troca.', price: 22, icon: '🧷' },
  { id: 'arm4', category: 'armarinho', name: 'Necessaire de costura', description: 'Agulhas, alfinetes, dedal e fita métrica em estojo compacto.', price: 45, icon: '🧺' },

  // DECORAÇÃO
  { id: 'dec1', category: 'decoracao', name: 'Quadro decorativo rústico', description: 'Moldura em madeira com estampa floral, 30x40cm.', price: 60, icon: '🖼️' },
  { id: 'dec2', category: 'decoracao', name: 'Vaso de cerâmica pintado à mão', description: 'Peça artesanal, ideal para flores ou temperos na cozinha.', price: 48, icon: '🏺' },
  { id: 'dec3', category: 'decoracao', name: 'Toalha de mesa bordada', description: 'Algodão 100%, bordado floral, 150x150cm.', price: 75, icon: '🪡' },
  { id: 'dec4', category: 'decoracao', name: 'Jogo de almofadas (2un)', description: 'Capas em tecido rústico, enchimento incluso.', price: 65, icon: '🛋️' },

  // MODA
  { id: 'mod1', category: 'moda', name: 'Blusa feminina básica', description: 'Malha 100% algodão, tamanhos P ao GG, várias cores.', price: 39, icon: '👚' },
  { id: 'mod2', category: 'moda', name: 'Camisa social masculina', description: 'Tecido leve, corte tradicional, tamanhos M ao GG.', price: 69, icon: '👔' },
  { id: 'mod3', category: 'moda', name: 'Vestido infantil floral', description: 'Tecido macio, tamanhos 2 a 10 anos.', price: 55, icon: '👗' },
  { id: 'mod4', category: 'moda', name: 'Calça jeans reta', description: 'Modelagem clássica, tamanhos 36 ao 46.', price: 89, icon: '👖' },

  // TREM DOCE
  { id: 'doc1', category: 'trem-doce', name: 'Bolo de pote (unidade)', description: 'Recheios variados: ninho com nutella, prestígio, red velvet.', price: 14, icon: '🍮' },
  { id: 'doc2', category: 'trem-doce', name: 'Caixa de brigadeiros gourmet (12un)', description: 'Sabores tradicionais e especiais, feitos na hora.', price: 32, icon: '🍫' },
  { id: 'doc3', category: 'trem-doce', name: 'Cookie artesanal (unidade)', description: 'Gotas de chocolate, receita da casa, crocante por fora.', price: 9, icon: '🍪' },
  { id: 'doc4', category: 'trem-doce', name: 'Doce de leite caseiro (300g)', description: 'Cremoso, feito em tacho de cobre, pote de vidro.', price: 24, icon: '🍯' },

  // TREM SALGADO
  { id: 'sal1', category: 'trem-salgado', name: 'Empada de frango (unidade)', description: 'Massa amanteigada, recheio generoso, assada na hora.', price: 8, icon: '🥧' },
  { id: 'sal2', category: 'trem-salgado', name: 'Caixa de coxinhas (10un)', description: 'Massa cremosa, recheio de frango desfiado.', price: 35, icon: '🍗' },
  { id: 'sal3', category: 'trem-salgado', name: 'Pão de queijo (6un)', description: 'Receita mineira tradicional, quentinho e macio.', price: 18, icon: '🧀' },
  { id: 'sal4', category: 'trem-salgado', name: 'Kit lanche da tarde', description: '2 empadas + 4 pães de queijo + 1 suco natural.', price: 42, icon: '🥤' }
];

const countRow = db.prepare('SELECT COUNT(*) AS n FROM products').get();
if (countRow.n === 0) {
  const insert = db.prepare(
    'INSERT INTO products (id, category, name, description, price, icon) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const p of SEED) {
    insert.run(p.id, p.category, p.name, p.description, p.price, p.icon);
  }
  console.log(`Banco criado e populado com ${SEED.length} produtos de exemplo.`);
}

module.exports = db;
