export default (sequelize, DataTypes) => {
  return sequelize.define('Cp_log', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    cpid: { type: DataTypes.STRING },
    cpsn: { type: DataTypes.STRING },
    log: { type: DataTypes.TEXT },
    inout: { type: DataTypes.STRING },
    time: { type: DataTypes.DATE }
  }, {
    tableName: 'cp_logs',
    timestamps: true
  });
};
