export default (sequelize, DataTypes) => {
  return sequelize.define('CartItem', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    CartId: { type: DataTypes.INTEGER },
    ProductId: { type: DataTypes.INTEGER },
    quantity: { type: DataTypes.INTEGER }
  }, {
    tableName: 'cartitems',
    timestamps: true
  });
};
