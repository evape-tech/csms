export default (sequelize, DataTypes) => {
  return sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    payment_method: { type: DataTypes.STRING },
    isSuccess: { type: DataTypes.BOOLEAN },
    failure_message: { type: DataTypes.TEXT },
    payTime: { type: DataTypes.DATE },
    OrderId: { type: DataTypes.INTEGER }
  }, {
    tableName: 'payments',
    timestamps: true
  });
};
