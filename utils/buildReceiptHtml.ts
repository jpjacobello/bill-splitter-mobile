import { PersonBreakdown, Receipt } from '../types';

const FOOD_EMOJIS: { keywords: string[]; emoji: string }[] = [
  // Burgers & sandwiches
  { keywords: ['burger', 'hamburger', 'cheeseburger', 'smash burger', 'smashburger'], emoji: '🍔' },
  { keywords: ['sandwich', 'sub', 'club', 'blt', 'wrap', 'hoagie', 'grinder', 'panini', 'grilled cheese', 'melt', 'philly', 'cheesesteak', 'po boy', 'po\'boy', 'cuban', 'reuben', 'gyro', 'banh mi', 'torta'], emoji: '🥪' },
  { keywords: ['hot dog', 'hotdog', 'frank', 'bratwurst', 'sausage', 'banger'], emoji: '🌭' },

  // Pizza & Italian
  { keywords: ['pizza', 'pie', 'slice', 'calzone', 'stromboli'], emoji: '🍕' },
  { keywords: ['pasta', 'spaghetti', 'fettuccine', 'linguine', 'penne', 'rigatoni', 'gnocchi', 'lasagna', 'carbonara', 'bolognese'], emoji: '🍝' },
  { keywords: ['noodle', 'lo mein', 'chow mein', 'udon', 'soba'], emoji: '🍜' },

  // Asian
  { keywords: ['sushi', 'roll', 'maki', 'nigiri', 'sashimi', 'temaki', 'omakase'], emoji: '🍣' },
  { keywords: ['ramen', 'pho', 'tonkotsu', 'miso soup'], emoji: '🍜' },
  { keywords: ['dumpling', 'gyoza', 'dim sum', 'bao', 'potsticker', 'wonton', 'har gow'], emoji: '🥟' },
  { keywords: ['rice', 'fried rice', 'risotto', 'bibimbap', 'congee', 'onigiri'], emoji: '🍚' },
  { keywords: ['soup', 'chowder', 'bisque', 'tom yum', 'hot pot', 'shabu'], emoji: '🫕' },
  { keywords: ['curry', 'tikka', 'masala', 'korma', 'vindaloo', 'pad thai', 'satay'], emoji: '🍛' },

  // Mexican
  { keywords: ['taco', 'birria', 'al pastor', 'carnitas', 'carne asada'], emoji: '🌮' },
  { keywords: ['burrito', 'bowl', 'quesadilla', 'nacho', 'enchilada', 'tamale', 'fajita'], emoji: '🌯' },
  { keywords: ['avocado', 'guacamole'], emoji: '🥑' },

  // Meat & seafood
  { keywords: ['steak', 'beef', 'ribeye', 'sirloin', 'filet', 'brisket', 'prime rib', 'wagyu', 'strip'], emoji: '🥩' },
  { keywords: ['chicken', 'poultry', 'hen', 'rotisserie', 'fried chicken', 'spicy chicken', 'grilled chicken', 'chicken breast', 'chicken thigh'], emoji: '🍗' },
  { keywords: ['wings', 'drumstick', 'tender', 'nugget', 'crispy chicken', 'chicken strip', 'chicken finger'], emoji: '🍗' },
  { keywords: ['ribs', 'bbq', 'pulled pork', 'barbeque', 'rack'], emoji: '🍖' },
  { keywords: ['lamb', 'chop', 'rack of lamb', 'gyro', 'shawarma', 'kebab'], emoji: '🍖' },
  { keywords: ['fish', 'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'branzino', 'sea bass'], emoji: '🐟' },
  { keywords: ['shrimp', 'prawn', 'scallop', 'seafood', 'calamari', 'squid', 'octopus'], emoji: '🦐' },
  { keywords: ['lobster', 'crab', 'king crab', 'snow crab', 'dungeness'], emoji: '🦞' },
  { keywords: ['oyster', 'clam', 'mussel', 'clams casino'], emoji: '🦪' },

  // Salads & veggies
  { keywords: ['salad', 'greens', 'caesar', 'arugula', 'kale', 'spinach', 'wedge', 'cobb', 'nicoise'], emoji: '🥗' },
  { keywords: ['mushroom', 'truffle', 'portobello'], emoji: '🍄' },
  { keywords: ['corn', 'elote'], emoji: '🌽' },
  { keywords: ['broccoli', 'broccolini', 'asparagus', 'brussels'], emoji: '🥦' },
  { keywords: ['tomato', 'caprese', 'panzanella'], emoji: '🍅' },
  { keywords: ['potato', 'mashed potato', 'gratin', 'hash brown', 'tater tot', 'loaded potato', 'baked potato'], emoji: '🥔' },
  { keywords: ['mac and cheese', 'mac & cheese', 'macaroni'], emoji: '🧀' },
  { keywords: ['onion ring', 'onion'], emoji: '🧅' },
  { keywords: ['pickle'], emoji: '🥒' },
  { keywords: ['flatbread', 'flatbread pizza'], emoji: '🫓' },

  // Sides & street food
  { keywords: ['fries', 'chips', 'waffle fry', 'steak fries', 'shoestring'], emoji: '🍟' },
  { keywords: ['bread', 'toast', 'baguette', 'focaccia', 'pita', 'naan'], emoji: '🫓' },
  { keywords: ['croissant', 'pastry', 'danish'], emoji: '🥐' },
  { keywords: ['pretzel', 'knish'], emoji: '🥨' },
  { keywords: ['cheese', 'brie', 'camembert', 'manchego', 'charcuterie', 'board'], emoji: '🧀' },

  // Breakfast
  { keywords: ['egg', 'omelette', 'benedict', 'scrambled', 'poached', 'frittata', 'quiche'], emoji: '🍳' },
  { keywords: ['pancake', 'french toast', 'crepe'], emoji: '🥞' },
  { keywords: ['waffle'], emoji: '🧇' },
  { keywords: ['bagel', 'lox'], emoji: '🥯' },
  { keywords: ['bacon', 'prosciutto', 'ham', 'canadian bacon'], emoji: '🥓' },

  // Desserts
  { keywords: ['ice cream', 'gelato', 'sundae', 'sorbet', 'soft serve'], emoji: '🍦' },
  { keywords: ['cake', 'cheesecake', 'tiramisu', 'panna cotta', 'mousse', 'tart'], emoji: '🍰' },
  { keywords: ['brownie', 'bar', 'blondie'], emoji: '🍫' },
  { keywords: ['donut', 'doughnut', 'churro', 'beignet'], emoji: '🍩' },
  { keywords: ['cookie', 'macaron', 'macaroon'], emoji: '🍪' },
  { keywords: ['fruit', 'berry', 'mango', 'pineapple', 'strawberry'], emoji: '🍓' },
  { keywords: ['chocolate', 'cocoa'], emoji: '🍫' },

  // Hot drinks
  { keywords: ['coffee', 'espresso', 'latte', 'cappuccino', 'mocha', 'americano', 'cold brew', 'flat white', 'macchiato'], emoji: '☕' },
  { keywords: ['tea', 'chai', 'matcha', 'boba', 'bubble tea', 'oolong', 'earl grey'], emoji: '🍵' },
  { keywords: ['hot chocolate', 'cocoa drink'], emoji: '☕' },

  // Cold drinks & non-alc
  { keywords: ['juice', 'orange juice', 'apple juice', 'pressed'], emoji: '🧃' },
  { keywords: ['lemonade', 'limeade', 'arnold palmer'], emoji: '🍋' },
  { keywords: ['smoothie', 'shake', 'milkshake', 'frappe'], emoji: '🥤' },
  { keywords: ['soda', 'coke', 'pepsi', 'sprite', 'cola', 'diet', 'ginger ale', 'root beer', 'dr pepper'], emoji: '🥤' },
  { keywords: ['water', 'sparkling', 'mineral', 'still', 'san pellegrino', 'perrier', 'fiji', 'evian'], emoji: '💧' },
  { keywords: ['energy drink', 'red bull', 'monster'], emoji: '⚡' },
  { keywords: ['milk', 'oat milk', 'almond milk'], emoji: '🥛' },
  { keywords: ['kombucha', 'kefir'], emoji: '🫙' },

  // Alcohol
  { keywords: ['beer', 'lager', 'ale', 'ipa', 'stout', 'porter', 'hefeweizen', 'pilsner', 'draft', 'pint', 'bud', 'budweiser', 'michelob', 'miller', 'coors', 'modelo', 'corona', 'heineken', 'guinness', 'stella', 'yuengling', 'blue moon', 'sam adams', 'dos equis', 'tecate', 'pacifico', 'lagunitas', 'sierra nevada', 'fat tire', 'goose island', 'pbr', 'pabst', 'natty', 'natural light', 'keystone', 'rolling rock', 'old style', 'hamms'], emoji: '🍺' },
  { keywords: ['wine', 'cabernet', 'merlot', 'chardonnay', 'pinot', 'rosé', 'rose', 'sauvignon', 'riesling', 'zinfandel', 'chianti', 'malbec', 'bordeaux', 'burgundy', 'barolo', 'tempranillo', 'syrah', 'shiraz', 'grenache', 'viognier', 'gewurztraminer', 'moscato', 'prosecco blend', 'house red', 'house white', 'glass of wine', 'bottle of wine'], emoji: '🍷' },
  { keywords: ['prosecco', 'champagne', 'cava', 'sparkling wine'], emoji: '🥂' },
  { keywords: ['cocktail', 'martini', 'cosmopolitan', 'cosmo', 'gimlet', 'gibson', 'vesper', 'margarita', 'mojito', 'daiquiri', 'spritz', 'negroni', 'paloma', 'aperol', 'sangria', 'old fashioned', 'manhattan', 'highball', 'sour', 'mule', 'fizz', 'smash', 'colada', 'hurricane', 'mai tai', 'long island'], emoji: '🍸' },
  { keywords: ['whiskey', 'bourbon', 'scotch', 'rye', 'shot', 'neat', 'on the rocks'], emoji: '🥃' },
  { keywords: ['vodka', 'tequila', 'gin', 'rum', 'mezcal'], emoji: '🥃' },
  { keywords: ['cider', 'hard cider', 'hard seltzer', 'white claw', 'truly'], emoji: '🍻' },

  // Receipt line items (non-food)
  { keywords: ['service charge', 'service fee', 'srv chg'], emoji: '🧾' },
  { keywords: ['gratuity', 'auto grat', 'auto-grat'], emoji: '🙏' },
  { keywords: ['delivery fee', 'delivery charge', 'courier'], emoji: '🚗' },
  { keywords: ['discount', 'coupon', 'promo', 'deal', 'offer', 'savings', 'comp'], emoji: '🏷️' },
  { keywords: ['fee', 'charge', 'surcharge', 'split fee', 'processing'], emoji: '💳' },
  { keywords: ['tax', 'vat', 'gst', 'hst', 'sales tax'], emoji: '🏛️' },
  { keywords: ['tip', 'gratuity'], emoji: '💰' },
  { keywords: ['bottle', 'bottle service', 'corkage'], emoji: '🍾' },

  // Catch-all appetizer/misc
  { keywords: ['appetizer', 'starter', 'bruschetta', 'crostini', 'charcuterie', 'mezze', 'tapas'], emoji: '🫕' },
];

export function getEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const { keywords, emoji } of FOOD_EMOJIS) {
    if (keywords.some((k) => lower.includes(k))) return emoji;
  }
  return '🍽️';
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function personColor(index: number): string {
  return COLORS[index % COLORS.length];
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Mono', monospace;
    background: #F5F3EF;
    padding: 32px 24px 48px;
    max-width: 560px;
    margin: 0 auto;
    color: #1a1a1a;
  }
  .receipt-top { text-align: center; margin-bottom: 28px; }
  .receipt-emoji { font-size: 44px; margin-bottom: 10px; }
  .receipt-title { font-size: 26px; font-weight: 500; color: #111; margin-bottom: 6px; letter-spacing: -0.5px; }
  .receipt-date { font-size: 12px; color: #999; font-weight: 400; letter-spacing: 0.5px; text-transform: uppercase; }
  .divider { border: none; border-top: 2px dashed #ccc; margin: 20px 0; }
  .card {
    background: #fff; border-radius: 12px; overflow: hidden;
    margin-bottom: 14px; box-shadow: 0 1px 8px rgba(0,0,0,0.06);
    border: 1px solid #E8E4DE;
  }
  .card-header {
    display: flex; align-items: center;
    padding: 13px 16px; gap: 10px;
  }
  .card-title { font-size: 15px; font-weight: 500; color: #fff; flex: 1; letter-spacing: 0.2px; }
  .host-badge {
    background: rgba(255,255,255,0.25); color: #fff; font-size: 10px;
    font-weight: 500; padding: 2px 8px; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .card-total { font-size: 18px; font-weight: 500; color: #fff; }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table td { padding: 8px 16px; font-size: 13px; color: #555; }
  .items-table td:last-child { text-align: right; font-weight: 500; white-space: nowrap; color: #111; }
  .item-name { font-weight: 400; color: #222; }
  .subtotal-row td, .tax-row td, .tip-row td {
    color: #888; font-size: 12px; padding-top: 4px; padding-bottom: 4px;
    border-top: 1px solid #F0EDE8;
  }
  .subtotal-row td { padding-top: 10px; }
  .total-row td { border-top: 1px dashed #ccc; padding-top: 10px; padding-bottom: 14px; font-size: 14px; color: #111; font-weight: 500; }
  .grand-total-box {
    background: #1a1a1a; color: #fff; border-radius: 10px;
    padding: 16px 18px; display: flex; justify-content: space-between;
    align-items: center; margin-top: 8px;
  }
  .grand-total-label { font-size: 13px; font-weight: 400; letter-spacing: 0.5px; text-transform: uppercase; color: #aaa; }
  .grand-total-value { font-size: 22px; font-weight: 500; }
  .footer { text-align: center; margin-top: 32px; margin-bottom: 32px; padding-bottom: 24px; font-size: 11px; color: #aaa; font-weight: 400; letter-spacing: 1px; text-transform: uppercase; }
`;

function formatDate(date?: string): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Individual person's split receipt
export function buildPersonReceiptHtml(breakdown: PersonBreakdown, colorIndex: number, merchantName?: string, date?: string): string {
  const title = merchantName || 'Dinner';
  const color = personColor(colorIndex);

  const rows = breakdown.assignedItems.map(({ item, share }) => `
    <tr>
      <td class="item-name">${getEmoji(item.name)} ${item.name}</td>
      <td>$${share.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style></head><body>
  <div class="receipt-top">
    <div class="receipt-emoji">🧾</div>
    <div class="receipt-title">${title}</div>
    <div class="receipt-date">${formatDate(date)}</div>
  </div>
  <hr class="divider">
  <div class="card">
    <div class="card-header" style="background:${color}">
      <span class="card-title">${breakdown.person.name}</span>
      ${breakdown.person.isHost ? '<span class="host-badge">paid</span>' : ''}
      <span class="card-total">$${breakdown.totalOwed.toFixed(2)}</span>
    </div>
    <table class="items-table"><tbody>
      ${rows}
      <tr class="subtotal-row"><td>Subtotal</td><td>$${breakdown.subtotal.toFixed(2)}</td></tr>
      <tr class="tax-row"><td>Tax</td><td>$${breakdown.taxShare.toFixed(2)}</td></tr>
      <tr class="tip-row"><td>Tip</td><td>$${breakdown.tipShare.toFixed(2)}</td></tr>
      <tr class="total-row"><td><strong>Total owed</strong></td><td><strong>$${breakdown.totalOwed.toFixed(2)}</strong></td></tr>
    </tbody></table>
  </div>
  <div class="footer">Split with Divi</div>
  </body></html>`;
}

// Full unsplit bill receipt
export function buildFullReceiptHtml(receipt: Receipt): string {
  const title = receipt.merchantName || 'Dinner';

  const rows = receipt.items.map((item) => `
    <tr>
      <td class="item-name">${getEmoji(item.name)} ${item.name}</td>
      <td>$${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${BASE_STYLES}</style></head><body>
  <div class="receipt-top">
    <div class="receipt-emoji">🧾</div>
    <div class="receipt-title">${title}</div>
    <div class="receipt-date">${formatDate(receipt.date)}</div>
  </div>
  <hr class="divider">
  <div class="card">
    <div class="card-header" style="background:#111">
      <span class="card-title">Full Bill</span>
      <span class="card-total">$${receipt.total.toFixed(2)}</span>
    </div>
    <table class="items-table"><tbody>
      ${rows}
      <tr class="subtotal-row"><td>Subtotal</td><td>$${receipt.subtotal.toFixed(2)}</td></tr>
      <tr class="tax-row"><td>Tax</td><td>$${receipt.tax.toFixed(2)}</td></tr>
      <tr class="tip-row"><td>Tip</td><td>$${receipt.tip.toFixed(2)}</td></tr>
      <tr class="total-row"><td><strong>Total</strong></td><td><strong>$${receipt.total.toFixed(2)}</strong></td></tr>
    </tbody></table>
  </div>
  <div class="footer">Split with Divi</div>
  </body></html>`;
}
