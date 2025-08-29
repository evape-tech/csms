export default (sequelize, DataTypes) => {
  return sequelize.define('Cart', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    UserId: { type: DataTypes.INTEGER }
  }, {
    tableName: 'carts',
    timestamps: true
  });
};
