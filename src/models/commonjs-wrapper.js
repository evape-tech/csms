// CommonJS wrapper for ES modules
const importModels = async () => {
  const models = await import('../models/index.js');
  return models.default;
};

let cachedModels = null;

const getModels = async () => {
  if (!cachedModels) {
    cachedModels = await importModels();
  }
  return cachedModels;
};

// Export a CommonJS-style object that loads models asynchronously
module.exports = {
  async getDb() {
    return await getModels();
  },
  
  // For backwards compatibility, expose common models
  async Gun() {
    const db = await getModels();
    return db.Gun;
  },
  
  async Cp_log() {
    const db = await getModels();
    return db.Cp_log;
  },
  
  async Order() {
    const db = await getModels();
    return db.Order;
  },
  
  async OrderItem() {
    const db = await getModels();
    return db.OrderItem;
  },
  
  async Cart() {
    const db = await getModels();
    return db.Cart;
  },
  
  async CartItem() {
    const db = await getModels();
    return db.CartItem;
  },
  
  async Payment() {
    const db = await getModels();
    return db.Payment;
  },
  
  async Product() {
    const db = await getModels();
    return db.Product;
  },
  
  async User() {
    const db = await getModels();
    return db.User;
  },
  
  async SiteSetting() {
    const db = await getModels();
    return db.SiteSetting;
  },
  
  get sequelize() {
    // Return a promise for sequelize instance
    return getModels().then(db => db.sequelize);
  }
};
