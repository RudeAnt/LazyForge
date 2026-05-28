import pandas as pd
from math_engine import (
    calculate_base_metrics,
    calculate_novelty,
    calculate_bayesian_error,
    calculate_class_deficit,
    calculate_utility,
    get_dataset_metrics
)

def initial_process_dataset(raw_df: pd.DataFrame) -> tuple:
    raw_df = raw_df.reset_index(drop=True)
    prob_cols = [col for col in raw_df.columns if col.startswith('prob_')]
    classes = [col.replace('prob_', '') for col in prob_cols]
    
    if 'комментарий' not in raw_df.columns: raw_df['комментарий'] = ""
    if 'нужен_эксперт' not in raw_df.columns: raw_df['нужен_эксперт'] = False

    df = calculate_base_metrics(raw_df, classes)
    df = calculate_novelty(df, classes)
    return df, classes

def recalculate_dynamic_metrics(df: pd.DataFrame, classes: list) -> pd.DataFrame:
    df = calculate_novelty(df, classes)
    df = calculate_bayesian_error(df)
    df = calculate_class_deficit(df, classes)
    df = calculate_utility(df)
    return df

def assign_status(row):
    if row['нужен_эксперт']: return 'Need_Info'
    if row['вероятность_ошибки_разметки'] > 0.5: return 'Potential_ERR'
    if row['norm_entropy'] > 0.6: return 'Ent_Chaos'
    return 'OK'

def generate_deterministic_roadmap(df: pd.DataFrame, classes: list) -> list:
    """
    ШАГ 3: Детерминированная дорожная карта.
    Формирует точные шаги на основе расчетов математического ядра.
    """
    actions = []
    
    # 1. Очистка дубликатов
    dupes = df['дубликат'].sum()
    if dupes > 0:
        actions.append(f"Удалить {dupes} дубликатов для снижения шума в обучающей выборке.")
        
    # 2. Перепроверка ошибок разметки
    errors = len(df[df['вероятность_ошибки_разметки'] > 0.5])
    if errors > 0:
        actions.append(f"Отправить на переразметку {errors} объектов (вероятность ошибки > 50%).")
        
    # 3. Экспертиза неопределенности
    chaos = len(df[df['norm_entropy'] > 0.6])
    if chaos > 0:
        actions.append(f"Привлечь эксперта для {chaos} сложных случаев (высокая энтропия предсказаний).")
        
    # 4. Устранение дефицита конкретных классов (Ключевое требование кейса)
    class_counts = df['истинный_класс'].value_counts()
    ideal_count = len(df) / len(classes) if len(classes) > 0 else 0
    
    for cls in classes:
        count = class_counts.get(cls, 0)
        # Если представленность класса меньше 80% от идеальной
        if count < ideal_count * 0.8: 
            missing = int(ideal_count - count)
            actions.append(f"Собрать минимум {missing} новых примеров для недонасыщенного класса '{cls}'.")
            
    if not actions:
        actions.append("Датасет сбалансирован и готов к обучению. Дополнительные действия не требуются.")
        
    return actions