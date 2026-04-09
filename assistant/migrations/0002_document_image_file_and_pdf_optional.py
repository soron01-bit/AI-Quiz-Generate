from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assistant', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='document',
            name='pdf_file',
            field=models.FileField(blank=True, null=True, upload_to='pdfs/'),
        ),
        migrations.AddField(
            model_name='document',
            name='image_file',
            field=models.FileField(blank=True, null=True, upload_to='images/'),
        ),
    ]
