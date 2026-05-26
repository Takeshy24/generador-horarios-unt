import enum


class RoleEnum(str, enum.Enum):
    admin = "admin"
    director_escuela = "director_escuela"
    director_depto = "director_depto"
    docente = "docente"


class TipoDocenteEnum(str, enum.Enum):
    nombrado = "nombrado"
    contratado = "contratado"


class RegimenEnum(str, enum.Enum):
    DE = "DE"
    TC = "TC"
    TP1 = "TP1"
    TP2 = "TP2"
    TP3 = "TP3"
    CONTRATO_A1 = "CONTRATO_A1"
    CONTRATO_A2 = "CONTRATO_A2"
    CONTRATO_A3 = "CONTRATO_A3"
    CONTRATO_B1 = "CONTRATO_B1"
    CONTRATO_B2 = "CONTRATO_B2"
    CONTRATO_B3 = "CONTRATO_B3"


class CategoriaEnum(str, enum.Enum):
    principal = "principal"
    asociado = "asociado"
    auxiliar = "auxiliar"


class DiaEnum(str, enum.Enum):
    LUN = "LUN"
    MAR = "MAR"
    MIE = "MIE"
    JUE = "JUE"
    VIE = "VIE"
    SAB = "SAB"


class TurnoEnum(str, enum.Enum):
    manana = "mañana"
    tarde = "tarde"
    indiferente = "indiferente"


class TipoAulaEnum(str, enum.Enum):
    comun = "comun"
    lab_computo = "lab_computo"
    lab_redes = "lab_redes"
    lab_bd = "lab_bd"
    lab_ia = "lab_ia"
    lab_software = "lab_software"
    auditorio = "auditorio"


class EstadoSemestreEnum(str, enum.Enum):
    configurando = "configurando"
    asignando = "asignando"
    generando = "generando"
    publicado = "publicado"


class TipoComponenteEnum(str, enum.Enum):
    T = "T"
    P = "P"
    L = "L"
