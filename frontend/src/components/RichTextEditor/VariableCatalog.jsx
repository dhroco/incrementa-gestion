import React, { useState, useEffect } from 'react';
import { VARIABLE_GROUPS, VARIABLE_CATALOG, searchVariables, getVariablesByGroup } from '../../data/variableCatalog';
import styles from './styles.module.css';

const VariableCatalog = ({ onVariableSelect, isOpen, onClose }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [filteredVariables, setFilteredVariables] = useState(VARIABLE_CATALOG);

  useEffect(() => {
    let variables = [];
    
    if (selectedGroup === 'all') {
      variables = VARIABLE_CATALOG;
    } else {
      variables = getVariablesByGroup(selectedGroup);
    }
    
    if (searchText) {
      variables = searchVariables(searchText).filter(variable => 
        selectedGroup === 'all' || variable.group === selectedGroup
      );
    }
    
    setFilteredVariables(variables);
  }, [searchText, selectedGroup]);

  const handleVariableClick = (variable) => {
    onVariableSelect(variable);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles['variable-catalog-overlay']} onClick={onClose} role="presentation">
      <div className={styles['variable-catalog']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['variable-catalog-header']}>
          <h3>Insertar Variable</h3>
          <button type="button" className={styles['close-button']} onClick={onClose}>×</button>
        </div>
        
        <div className={styles['variable-catalog-controls']}>
          <input
            type="text"
            placeholder="Buscar variables..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles['search-input']}
          />
          
          <div className={styles['group-filters']}>
            <button
              type="button"
              className={`${styles['group-filter']} ${selectedGroup === 'all' ? styles['group-filter-active'] : ''}`}
              onClick={() => setSelectedGroup('all')}
            >
              Todas
            </button>
            {Object.values(VARIABLE_GROUPS).map(group => (
              <button
                type="button"
                key={group.id}
                className={`${styles['group-filter']} ${selectedGroup === group.id ? styles['group-filter-active'] : ''}`}
                onClick={() => setSelectedGroup(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className={styles['variable-list']}>
          {filteredVariables.length === 0 ? (
            <div className={styles['no-results']}>No se encontraron variables</div>
          ) : (
            filteredVariables.map(variable => (
              <div
                key={variable.id}
                className={styles['variable-item']}
                onClick={() => handleVariableClick(variable)}
              >
                <div className={styles['variable-item-header']}>
                  <span className={styles['variable-label']}>{variable.label}</span>
                  <span className={`${styles['variable-group-badge']} ${variable.group}`}>
                    {variable.groupLabel}
                  </span>
                </div>
                <div className={styles['variable-description']}>{variable.description}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VariableCatalog;
