"""Transform parser engine for processing CSV/JSON/XML files."""
import csv
import json
import xml.etree.ElementTree as ET
from io import StringIO
from typing import List, Dict, Any, Callable
from datetime import datetime
import dateutil.parser


class TransformParser:
    """Parse files using transform mappings."""
    
    def __init__(self, transform_mapping: Dict[str, Any]):
        """
        Initialize parser with transform mapping.
        
        Args:
            transform_mapping: Dictionary containing field mappings and rules
                {
                    'fields': [
                        {
                            'source': 'input_field_name',
                            'target': 'timeline_column_name',
                            'type': 'timestamp|text|number|tags|boolean',
                            'format': 'optional format string for dates',
                            'default': 'optional default value',
                            'transform': 'optional transformation rule'
                        }
                    ],
                    'options': {
                        'csv_delimiter': ',',
                        'csv_has_header': true,
                        'json_path': 'path.to.array',
                        'xml_record_path': 'root/record',
                        'skip_errors': true
                    }
                }
        """
        self.mapping = transform_mapping
        self.fields = transform_mapping.get('fields', [])
        self.options = transform_mapping.get('options', {})
    
    def parse_csv(self, file_content: str) -> List[Dict[str, Any]]:
        """Parse CSV content and apply transformations."""
        delimiter = self.options.get('csv_delimiter', ',')
        has_header = self.options.get('csv_has_header', True)
        skip_errors = self.options.get('skip_errors', True)
        
        reader = csv.DictReader(
            StringIO(file_content), 
            delimiter=delimiter
        ) if has_header else csv.reader(StringIO(file_content), delimiter=delimiter)
        
        results = []
        for row_num, row in enumerate(reader, start=1):
            try:
                if has_header:
                    transformed = self._transform_row(row)
                else:
                    # For headerless CSV, map by position
                    row_dict = {f"col_{i}": val for i, val in enumerate(row)}
                    transformed = self._transform_row(row_dict)
                
                if transformed:
                    results.append(transformed)
            except Exception as e:
                if not skip_errors:
                    raise ValueError(f"Error parsing row {row_num}: {str(e)}")
                # Skip row on error if skip_errors is True
                continue
        
        return results
    
    def parse_json(self, file_content: str) -> List[Dict[str, Any]]:
        """Parse JSON content and apply transformations."""
        skip_errors = self.options.get('skip_errors', True)
        json_path = self.options.get('json_path', '')
        
        data = json.loads(file_content)
        
        # Navigate to the array using json_path if specified
        if json_path:
            for key in json_path.split('.'):
                data = data.get(key, [])
        
        # Ensure we have a list
        if not isinstance(data, list):
            data = [data]
        
        results = []
        for item_num, item in enumerate(data, start=1):
            try:
                transformed = self._transform_row(item)
                if transformed:
                    results.append(transformed)
            except Exception as e:
                if not skip_errors:
                    raise ValueError(f"Error parsing item {item_num}: {str(e)}")
                continue
        
        return results
    
    def parse_xml(self, file_content: str) -> List[Dict[str, Any]]:
        """Parse XML content and apply transformations."""
        skip_errors = self.options.get('skip_errors', True)
        record_path = self.options.get('xml_record_path', '')
        
        root = ET.fromstring(file_content)
        
        # Find records using XPath-like path
        if record_path:
            elements = root.findall(record_path)
        else:
            elements = list(root)
        
        results = []
        for elem_num, elem in enumerate(elements, start=1):
            try:
                # Convert XML element to dict
                item = self._xml_to_dict(elem)
                transformed = self._transform_row(item)
                if transformed:
                    results.append(transformed)
            except Exception as e:
                if not skip_errors:
                    raise ValueError(f"Error parsing element {elem_num}: {str(e)}")
                continue
        
        return results
    
    def _xml_to_dict(self, element: ET.Element) -> Dict[str, Any]:
        """Convert XML element to dictionary."""
        result = {}
        
        # Add attributes
        result.update(element.attrib)
        
        # Add text content
        if element.text and element.text.strip():
            result['_text'] = element.text.strip()
        
        # Add child elements
        for child in element:
            child_data = self._xml_to_dict(child)
            tag = child.tag.split('}')[-1]  # Remove namespace
            
            if tag in result:
                # Handle multiple children with same tag
                if not isinstance(result[tag], list):
                    result[tag] = [result[tag]]
                result[tag].append(child_data)
            else:
                result[tag] = child_data
        
        return result
    
    def _transform_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a single row according to field mappings."""
        result = {}
        
        for field_mapping in self.fields:
            source = field_mapping.get('source')
            target = field_mapping.get('target')
            field_type = field_mapping.get('type', 'text')
            default = field_mapping.get('default')
            date_format = field_mapping.get('format')
            
            if not source or not target:
                continue
            
            # Get source value (support nested keys with dot notation)
            value = self._get_nested_value(row, source)
            
            # Use default if value is empty
            if value is None or value == '':
                value = default
            
            # Skip if still no value
            if value is None:
                continue
            
            # Apply type conversion
            try:
                converted_value = self._convert_type(value, field_type, date_format)
                result[target] = converted_value
            except Exception as e:
                # Skip field if conversion fails
                continue
        
        return result
    
    def _get_nested_value(self, data: Dict[str, Any], key: str) -> Any:
        """Get value from nested dictionary using dot notation."""
        keys = key.split('.')
        value = data
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return None
            
            if value is None:
                return None
        
        return value
    
    def _convert_type(self, value: Any, field_type: str, date_format: str = None) -> Any:
        """Convert value to specified type."""
        if value is None or value == '':
            return None
        
        if field_type == 'timestamp':
            if isinstance(value, str):
                if date_format:
                    return datetime.strptime(value, date_format).isoformat()
                else:
                    # Try to parse using dateutil
                    return dateutil.parser.parse(value).isoformat()
            return value
        
        elif field_type == 'number':
            return float(value) if '.' in str(value) else int(value)
        
        elif field_type == 'boolean':
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ('true', 'yes', '1', 'y', 't')
            return bool(value)
        
        elif field_type == 'tags':
            if isinstance(value, list):
                return value
            if isinstance(value, str):
                # Split by common delimiters
                for delimiter in [',', ';', '|']:
                    if delimiter in value:
                        return [tag.strip() for tag in value.split(delimiter)]
                return [value]
            return [str(value)]
        
        else:  # text or default
            return str(value)


def parse_file(file_content: str, input_format: str, transform_mapping: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parse a file using the specified transform mapping.
    
    Args:
        file_content: String content of the file
        input_format: File format (csv, json, xml)
        transform_mapping: Transform mapping configuration
    
    Returns:
        List of transformed records ready for timeline entry creation
    """
    parser = TransformParser(transform_mapping)
    
    if input_format == 'csv':
        return parser.parse_csv(file_content)
    elif input_format == 'json':
        return parser.parse_json(file_content)
    elif input_format == 'xml':
        return parser.parse_xml(file_content)
    else:
        raise ValueError(f"Unsupported input format: {input_format}")
