import React from 'react';
import classes from './MySelect.module.css';

const MySelect = (props) => {
    return (
        <div className={classes.field}>
            {props.label && <label className={classes.label}>{props.label}</label>}
            <select
                className={classes.mySelect}
                value={props.value}
                onChange={e => props.onChange(e.target.value)}
            >
                <option disabled={props.disableDefault !== undefined ? props.disableDefault : true} value=''>
                    {props.defaultOption || props.defaultValue}
                </option>
                {props.options.map(option =>
                    <option value={option.value} key={option.value}>
                        {option.name}
                    </option>
                )}
            </select>
        </div>
    );
};

export default MySelect;