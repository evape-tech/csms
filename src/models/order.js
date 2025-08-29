export default (sequelize, DataTypes) => {
  return sequelize.define('Order', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    amount: { type: DataTypes.INTEGER },
    sn: { type: DataTypes.STRING },
    shipping_status: { type: DataTypes.STRING },
    payment_status: { type: DataTypes.STRING },
    UserId: { type: DataTypes.INTEGER }
  }, {
    tableName: 'orders',
    timestamps: true
  });
};
