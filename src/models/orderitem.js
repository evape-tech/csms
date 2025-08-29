export default (sequelize, DataTypes) => {
  return sequelize.define('OrderItem', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    OrderId: { type: DataTypes.INTEGER },
    ProductId: { type: DataTypes.INTEGER },
    price: { type: DataTypes.INTEGER },
    quantity: { type: DataTypes.INTEGER }
  }, {
    tableName: 'orderitems',
    timestamps: true
  });
};
