"""Database models.

Importing every model here matters: `Base.metadata` only knows about tables
whose module has been imported, so `create_all` would silently skip any model
nobody imported yet. It also lets callers write `from app.models import Entry`
without caring which file it lives in.
"""
from app.models.base import Base
from app.models.entry import Entry
from app.models.fact import CATEGORIES, Category, Fact
from app.models.mantra import Mantra
from app.models.meal import CATEGORIES as MEAL_CATEGORIES
from app.models.meal import METHODS, PROTEINS, SEASONS, SOURCES, Meal
from app.models.meal_note import MealNote
from app.models.profile import Profile
from app.models.question import Question
from app.models.shopping import SECTIONS, ShoppingItem
from app.models.today import Goal, Habit, HabitCheck, Principle

# Marks these as deliberate re-exports, so the linter doesn't read them as
# unused imports.
__all__ = [
    "Base",
    "CATEGORIES",
    "Category",
    "Entry",
    "Fact",
    "Goal",
    "Habit",
    "HabitCheck",
    "Principle",
    "Mantra",
    "Meal",
    "MealNote",
    "MEAL_CATEGORIES",
    "METHODS",
    "PROTEINS",
    "SEASONS",
    "SOURCES",
    "Profile",
    "Question",
    "SECTIONS",
    "ShoppingItem",
]
