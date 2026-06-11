from .extensions import db


class ModelingMerged(db.Model):
    __tablename__ = "modeling_merged"

    id = db.Column("rowid", db.Integer, primary_key=True)
    Lot_Num = db.Column(db.Integer)
    Wafer_Num = db.Column(db.Integer)
    Datetime = db.Column(db.Text)
    Ox_Chamber = db.Column(db.Integer)
    type = db.Column(db.Text)
    Temp_OXid = db.Column(db.Float)
    ppm = db.Column(db.Float)
    Pressure = db.Column(db.Float)
    Oxid_time = db.Column(db.Integer)
    thickness = db.Column(db.Float)
    photo_soft_Chamber = db.Column(db.Integer)
    resist_target = db.Column(db.Float)
    N2_HMDS = db.Column(db.Float)
    pressure_HMDS = db.Column(db.Float)
    temp_HMDS = db.Column(db.Float)
    temp_HMDS_bake = db.Column(db.Float)
    time_HMDS_bake = db.Column(db.Float)
    spin1 = db.Column(db.Float)
    spin2 = db.Column(db.Float)
    spin3 = db.Column(db.Float)
    photoresist_bake = db.Column(db.Float)
    temp_softbake = db.Column(db.Float)
    time_softbake = db.Column(db.Float)
    lithography_Chamber = db.Column(db.Integer)
    Line_CD = db.Column(db.Float)
    UV_type = db.Column(db.Text)
    Resolution = db.Column(db.Float)
    Energy_Exposure = db.Column(db.Float)
    Ion_Chamber = db.Column(db.Integer)
    Flux60s = db.Column(db.Float)
    Flux90s = db.Column(db.Float)
    Flux160s = db.Column(db.Float)
    Flux480s = db.Column(db.Float)
    Flux840s = db.Column(db.Float)
    input_Energy = db.Column(db.Float)
    Temp_implantation = db.Column(db.Float)
    Furance_Temp = db.Column(db.Float)
    RTA_Temp = db.Column(db.Integer)
    Etching_Chamber = db.Column(db.Integer)
    Temp_Etching = db.Column(db.Float)
    Source_Power = db.Column(db.Float)
    Selectivity = db.Column(db.Float)
    is_low_yield = db.Column(db.Integer)

    def to_dict(self):
        return {
            c.name: getattr(self, c.key)
            for c in self.__table__.columns
            if c.name != "rowid"
        }


class WaferInspection(db.Model):
    __tablename__ = "wafer_inspections"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    lot_num = db.Column(db.Integer, nullable=False)
    wafer_num = db.Column(db.Integer, nullable=False)
    wafer_count = db.Column(db.Integer, nullable=False, default=1)
    applied_to_all = db.Column(db.Boolean, nullable=False, default=False)
    process = db.Column(db.Text, nullable=False)
    process_label = db.Column(db.Text, nullable=False)
    risk_level = db.Column(db.Text, nullable=False)
    bad_prob_percent = db.Column(db.Float, nullable=False)
    result_type = db.Column(db.Text)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "lot_num": self.lot_num,
            "wafer_num": self.wafer_num,
            "wafer_count": self.wafer_count,
            "applied_to_all": self.applied_to_all,
            "process": self.process,
            "process_label": self.process_label,
            "risk_level": self.risk_level,
            "bad_prob_percent": self.bad_prob_percent,
            "result_type": self.result_type,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
