"""add reservas recuperacion

Revision ID: a1b2c3d4e5f6
Revises: 4b029898fcf0
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "4b029898fcf0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reservas_recuperacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("docente_id", sa.Integer(), nullable=False),
        sa.Column("aula_id", sa.Integer(), nullable=False),
        sa.Column("semestre_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("hora_inicio", sa.Time(), nullable=False),
        sa.Column("hora_fin", sa.Time(), nullable=False),
        sa.Column("motivo", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["docente_id"], ["docentes.id"]),
        sa.ForeignKeyConstraint(["aula_id"], ["aulas.id"]),
        sa.ForeignKeyConstraint(["semestre_id"], ["semestres.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reservas_recuperacion_docente_id", "reservas_recuperacion", ["docente_id"])
    op.create_index("ix_reservas_recuperacion_fecha", "reservas_recuperacion", ["fecha"])
    op.create_index("ix_reservas_recuperacion_aula_fecha", "reservas_recuperacion", ["aula_id", "fecha"])


def downgrade() -> None:
    op.drop_index("ix_reservas_recuperacion_aula_fecha", table_name="reservas_recuperacion")
    op.drop_index("ix_reservas_recuperacion_fecha", table_name="reservas_recuperacion")
    op.drop_index("ix_reservas_recuperacion_docente_id", table_name="reservas_recuperacion")
    op.drop_table("reservas_recuperacion")
