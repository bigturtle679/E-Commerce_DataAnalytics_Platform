{% macro generate_surrogate_key(field_list) %}
    {{ dbt_utils.generate_surrogate_key(field_list) if dbt_utils is defined else "md5(concat(" ~ field_list | join(", '||', ") ~ "))" }}
{% endmacro %}
