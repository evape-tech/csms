import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';

// Import model definitions
import gunModel from './gun.js';
import cpLogModel from './cp_log.js';
import orderModel from './order.js';
import orderItemModel from './orderitem.js';
import cartModel from './cart.js';
import cartItemModel from './cartitem.js';
import paymentModel from './payment.js';
import productModel from './product.js';
import userModel from './user.js';
import siteSettingModel from './site_setting.js';

dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME || 'benson_csms_db', process.env.DB_USER || 'root', process.env.DB_PASS || '', {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const db = { sequelize, Sequelize };

// Initialize models
db.Gun = gunModel(sequelize, DataTypes);
db.Cp_log = cpLogModel(sequelize, DataTypes);
db.Order = orderModel(sequelize, DataTypes);
db.OrderItem = orderItemModel(sequelize, DataTypes);
db.Cart = cartModel(sequelize, DataTypes);
db.CartItem = cartItemModel(sequelize, DataTypes);
db.Payment = paymentModel(sequelize, DataTypes);
db.Product = productModel(sequelize, DataTypes);
db.User = userModel(sequelize, DataTypes);
db.SiteSetting = siteSettingModel(sequelize, DataTypes);

// associations (basic)
db.Order.hasMany(db.OrderItem, { foreignKey: 'OrderId' });
db.OrderItem.belongsTo(db.Order, { foreignKey: 'OrderId' });

db.Cart.hasMany(db.CartItem, { foreignKey: 'CartId' });
db.CartItem.belongsTo(db.Cart, { foreignKey: 'CartId' });

db.Payment.belongsTo(db.Order, { foreignKey: 'OrderId' });

// sync in development only — make this opt-in to avoid accidental DB connects when the
// models module is imported by the Next.js/Turbopack build/runtime. Set AUTO_DB_SYNC=true
// in your environment if you want automatic syncing during development.
if (process.env.NODE_ENV !== 'production' && process.env.AUTO_DB_SYNC === 'true') {
  sequelize.sync({ alter: true }).then(() => {
    console.log('Sequelize: synced models to database');
  }).catch(err => console.error('Sequelize sync error', err));
} else if (process.env.NODE_ENV !== 'production') {
  console.log('Sequelize: auto sync disabled (set AUTO_DB_SYNC=true to enable)');
}

export default db;
