import pandas as pd
from math_engine import (
    calculate_base_metrics,
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
    return df, classes

def recalculate_dynamic_metrics(df: pd.DataFrame, classes: list) -> pd.DataFrame:
    df = calculate_bayesian_error(df)
    df = calculate_class_deficit(df, classes)
    df = calculate_utility(df)
    return df

def assign_status(row):
    if row['нужен_эксперт']: return 'Need_Info'
    if row['вероятность_ошибки_разметки'] > 0.5: return 'Potential_ERR'
    if row['norm_entropy'] > 0.6: return 'Ent_Chaos'
    return 'OK'
