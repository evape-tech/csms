export default (sequelize, DataTypes) => {
  return sequelize.define('Gun', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    connector: { type: DataTypes.STRING },
    cpid: { type: DataTypes.STRING },
    cpsn: { type: DataTypes.STRING },
    guns_status: { type: DataTypes.STRING },
    guns_metervalue1: { type: DataTypes.STRING },
    guns_metervalue2: { type: DataTypes.STRING },
    guns_metervalue3: { type: DataTypes.STRING },
    guns_metervalue4: { type: DataTypes.STRING },
    guns_metervalue5: { type: DataTypes.STRING },
    guns_metervalue6: { type: DataTypes.STRING },
    guns_memo1: { type: DataTypes.STRING },
    guns_memo2: { type: DataTypes.STRING },
    transactionid: { type: DataTypes.STRING },
    acdc: { type: DataTypes.ENUM('AC','DC') , defaultValue: 'AC' },
    max_kw: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    tableName: 'guns',
    timestamps: true
  });
};
