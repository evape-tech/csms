export default (sequelize, DataTypes) => {
  return sequelize.define('SiteSetting', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    ems_mode: { type: DataTypes.STRING, defaultValue: 'static' },
    max_power_kw: { type: DataTypes.DECIMAL(10,2), defaultValue: 480.00 }
  }, {
    tableName: 'site_settings',
    timestamps: false
  });
};
