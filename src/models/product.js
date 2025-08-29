export default (sequelize, DataTypes) => {
  return sequelize.define('Product', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.INTEGER },
    image: { type: DataTypes.STRING }
  }, {
    tableName: 'products',
    timestamps: true
  });
};
